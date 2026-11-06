import { sql } from "kysely"

import {
  extractAndPersistAudioCover,
  extractAndPersistTextCover,
} from "@/assets/covers"
import { relocateAssetsIntoBook } from "@/assets/fs"
import {
  type BookRelationsUpdate,
  type BookWithRelations,
  type CreatorRelation,
  getBooks,
  updateBook,
} from "@/database/books"
import { db } from "@/database/connection"
import { logger } from "@/logging"
import {
  HIGH_SCORE,
  type MatchCandidate,
  type MatchScore,
  normalizeText,
  normalizeTitle,
  scoreMatch,
} from "@/metadata/match"
import { subjectFromBook } from "@/metadata/subject"
import { type UUID } from "@/uuid"
import { queueWritesToFiles } from "@/writeToFiles/fileWriteDistributor"

/**
 * Finds ebooks and audiobooks that are the same title but were imported as two
 * separate books, and merges each pair into one book that has both formats.
 *
 * It only acts when it is very sure: a shared identifier (ISBN or ASIN), or a
 * near-identical title together with a matching author. A pair must also be
 * each other's clear best match, and the numbers in the titles must agree, so
 * "Book 1" is never joined to "Book 2".
 */

/**
 * How sure the match is.
 *  - high: a shared identifier, or the same title and the same author.
 *  - probable: the same, fairly long title but no matching author. Audiobook
 *    metadata often lists the narrator as the author, so this is common. It is
 *    only merged automatically when the level is set to "probable".
 */
export type Confidence = "high" | "probable"
export type LinkLevel = Confidence

type Reason = "identifier" | "title-and-author" | "title-only"
type Judgement = { score: number; reason: Reason; confidence: Confidence }

export type LinkPair = {
  ebookBook: BookWithRelations
  audiobookBook: BookWithRelations
  score: number
  reason: Reason
  confidence: Confidence
}

export type AmbiguousMatch = {
  title: string
  /** Books of the other format that look equally right. */
  candidates: string[]
}

const MIN_MARGIN = 0.06
const MIN_TITLE = 0.85
const MIN_AUTHORS = 0.8
// A title-only match needs a distinctive title: "Home" proves nothing.
const MIN_TITLE_ONLY = 0.95
const MIN_TITLE_WORDS = 2
const MIN_TITLE_CHARS = 12

function signal(score: MatchScore, name: string) {
  return score.signals.find((s) => s.name === name)?.score
}

function numberTokens(title: string) {
  return (title.match(/\d+/g) ?? []).sort().join(",")
}

function seriesPositionsAgree(
  a: BookWithRelations,
  b: BookWithRelations,
): boolean {
  for (const seriesA of a.series) {
    const match = b.series.find(
      (seriesB) => normalizeText(seriesB.name) === normalizeText(seriesA.name),
    )
    if (
      match &&
      seriesA.position != null &&
      match.position != null &&
      seriesA.position !== match.position
    ) {
      return false
    }
  }
  return true
}

function asCandidate(book: BookWithRelations): MatchCandidate {
  const subject = subjectFromBook(book)
  return {
    // Not an external provider; the matcher only reads the fields below.
    provider: "local" as MatchCandidate["provider"],
    id: book.uuid,
    title: subject.title,
    subtitle: subject.subtitle ?? null,
    authors: subject.authors,
    narrators: subject.narrators,
    seriesNames: subject.seriesNames,
    publicationYear: subject.publicationYear ?? null,
    durationSeconds: null,
    pageCount: null,
    isbns: subject.isbns,
    asins: subject.asins,
  }
}

function judge(
  ebookBook: BookWithRelations,
  audiobookBook: BookWithRelations,
): Judgement | null {
  if (numberTokens(ebookBook.title) !== numberTokens(audiobookBook.title)) {
    return null
  }
  if (!seriesPositionsAgree(ebookBook, audiobookBook)) return null

  // Duration and page count are not comparable across formats, so leave them out.
  const subject = {
    ...subjectFromBook(ebookBook),
    durationSeconds: null,
    pageCount: null,
  }
  const result = scoreMatch(subject, asCandidate(audiobookBook))

  const title = signal(result, "title") ?? 0
  const identifier = signal(result, "identifier")
  if (identifier === 1 && title >= 0.5) {
    return { score: result.score, reason: "identifier", confidence: "high" }
  }
  // Conflicting identifiers (a different ISBN or ASIN) are a hard no.
  if (identifier === 0) return null

  const authors = signal(result, "authors")
  if (
    title >= MIN_TITLE &&
    authors !== undefined &&
    authors >= MIN_AUTHORS &&
    result.score >= HIGH_SCORE
  ) {
    return {
      score: result.score,
      reason: "title-and-author",
      confidence: "high",
    }
  }

  // Same distinctive title, authors missing or different (often the narrator
  // listed as the author): probable, not certain.
  const normalized = normalizeTitle(ebookBook.title)
  if (
    title >= MIN_TITLE_ONLY &&
    normalized.length >= MIN_TITLE_CHARS &&
    normalized.split(" ").length >= MIN_TITLE_WORDS
  ) {
    return { score: title, reason: "title-only", confidence: "probable" }
  }
  return null
}

function best(candidates: { uuid: string; score: number }[]) {
  const sorted = [...candidates].sort((x, y) => y.score - x.score)
  const top = sorted[0]
  if (!top) return null
  return { ...top, margin: top.score - (sorted[1]?.score ?? 0) }
}

export type LinkPlan = { pairs: LinkPair[]; ambiguous: AmbiguousMatch[] }

export function findLinkPairs(books: BookWithRelations[]): LinkPair[] {
  return findLinkPlan(books).pairs
}

export function findLinkPlan(books: BookWithRelations[]): LinkPlan {
  const ebooks = books.filter((b) => b.ebook && !b.audiobook && !b.readaloud)
  const audiobooks = books.filter(
    (b) => b.audiobook && !b.ebook && !b.readaloud,
  )

  const judgements = new Map<string, Map<string, Judgement>>()
  for (const e of ebooks) {
    const row = new Map<string, Judgement>()
    for (const a of audiobooks) {
      const judged = judge(e, a)
      if (judged) row.set(a.uuid, judged)
    }
    if (row.size) judgements.set(e.uuid, row)
  }

  const pairs: LinkPair[] = []
  const ambiguous: AmbiguousMatch[] = []
  const titleOf = new Map<string, string>(books.map((b) => [b.uuid, b.title]))
  for (const e of ebooks) {
    const row = judgements.get(e.uuid)
    if (!row) continue

    const bestAudio = best(
      [...row.entries()].map(([uuid, v]) => ({ uuid, score: v.score })),
    )
    if (!bestAudio) continue
    // Several audiobooks that look alike: do nothing rather than guess, but
    // say so, so the preview can show it.
    if (row.size > 1 && bestAudio.margin < MIN_MARGIN) {
      ambiguous.push({
        title: e.title,
        candidates: [...row.keys()].map((uuid) => titleOf.get(uuid) ?? uuid),
      })
      continue
    }

    // The audiobook must also pick this ebook, with a clear lead.
    const reverse = ebooks.flatMap((other) => {
      const v = judgements.get(other.uuid)?.get(bestAudio.uuid)
      return v ? [{ uuid: other.uuid, score: v.score }] : []
    })
    const bestEbook = best(reverse)
    if (!bestEbook || bestEbook.uuid !== e.uuid) continue
    if (reverse.length > 1 && bestEbook.margin < MIN_MARGIN) {
      ambiguous.push({
        title: titleOf.get(bestAudio.uuid) ?? bestAudio.uuid,
        candidates: reverse.map((r) => titleOf.get(r.uuid) ?? r.uuid),
      })
      continue
    }

    const audiobookBook = audiobooks.find((a) => a.uuid === bestAudio.uuid)
    const judged = row.get(bestAudio.uuid)
    if (!audiobookBook || !judged) continue
    pairs.push({
      ebookBook: e,
      audiobookBook,
      score: judged.score,
      reason: judged.reason,
      confidence: judged.confidence,
    })
  }
  return { pairs, ambiguous }
}

/**
 * Moves per-user data that the merge would otherwise drop with the removed
 * book (reading status, rating, shelf entries, progress) onto the kept book,
 * wherever the kept book has nothing of its own for that user or shelf.
 */
export async function keepUserData(target: UUID, other: UUID) {
  await sql`UPDATE book_to_status SET book_uuid = ${target}
    WHERE book_uuid = ${other}
    AND user_id NOT IN (SELECT user_id FROM book_to_status WHERE book_uuid = ${target})`.execute(
    db,
  )
  await sql`UPDATE user_book_rating SET book_uuid = ${target}
    WHERE book_uuid = ${other}
    AND user_id NOT IN (SELECT user_id FROM user_book_rating WHERE book_uuid = ${target})`.execute(
    db,
  )
  await sql`UPDATE shelf_book SET book_uuid = ${target}
    WHERE book_uuid = ${other}
    AND shelf_uuid NOT IN (SELECT shelf_uuid FROM shelf_book WHERE book_uuid = ${target})`.execute(
    db,
  )
  await sql`UPDATE progression SET book_uuid = ${target}
    WHERE book_uuid = ${other}
    AND NOT EXISTS (
      SELECT 1 FROM progression p
      WHERE p.book_uuid = ${target}
      AND p.user_id = progression.user_id
      AND p.format = progression.format)`.execute(db)
  await sql`UPDATE progression_history SET book_uuid = ${target}
    WHERE book_uuid = ${other}
    AND NOT EXISTS (
      SELECT 1 FROM progression_history h
      WHERE h.book_uuid = ${target}
      AND h.user_id = progression_history.user_id
      AND h.modified = progression_history.modified)`.execute(db)
}

export async function mergePair(pair: LinkPair): Promise<BookWithRelations> {
  const { ebookBook, audiobookBook } = pair
  const books = [ebookBook, audiobookBook]

  const creators = new Map<string, CreatorRelation>()
  for (const book of books) {
    for (const author of book.authors) {
      creators.set(`${author.uuid}:aut`, { ...author, role: "aut" })
    }
    for (const narrator of book.narrators) {
      creators.set(`${narrator.uuid}:nrt`, { ...narrator, role: "nrt" })
    }
    for (const creator of book.creators) {
      creators.set(`${creator.uuid}:${creator.role}`, creator)
    }
  }

  const series = new Map<string, { name: string; position?: number | null }>()
  for (const book of books) {
    for (const s of book.series) {
      const existing = series.get(s.name)
      if (!existing || (existing.position == null && s.position != null)) {
        series.set(s.name, { name: s.name, position: s.position })
      }
    }
  }

  const relations: BookRelationsUpdate = {
    creators: [...creators.values()],
    series: [...series.values()] as NonNullable<BookRelationsUpdate["series"]>,
    collections: [
      ...new Set(books.flatMap((b) => b.collections.map((c) => c.uuid))),
    ],
    tags: [...new Set(books.flatMap((b) => b.tags.map((t) => t.name)))],
    books: [audiobookBook.uuid],
  }

  await keepUserData(ebookBook.uuid, audiobookBook.uuid)

  let merged = await updateBook(
    ebookBook.uuid,
    {
      title: ebookBook.title || audiobookBook.title,
      subtitle: ebookBook.subtitle || audiobookBook.subtitle,
      language: ebookBook.language || audiobookBook.language,
      description: ebookBook.description || audiobookBook.description,
      publicationDate:
        ebookBook.publicationDate || audiobookBook.publicationDate,
      releaseDate: audiobookBook.releaseDate || ebookBook.releaseDate,
    },
    relations,
  )

  merged = await relocateAssetsIntoBook(merged)
  await extractAndPersistTextCover(
    merged,
    merged.ebook?.filepath ?? null,
    merged.readaloud?.filepath ?? null,
  )
  await extractAndPersistAudioCover(
    merged,
    merged.audiobook?.filepath ?? null,
    merged.readaloud?.filepath ?? null,
  )
  void queueWritesToFiles(merged.uuid)
  return merged
}

export type LinkRunResult = {
  considered: number
  level: LinkLevel
  pairs: {
    ebook: string
    audiobook: string
    reason: Reason
    confidence: Confidence
    score: number
    /** Whether a real run at this level would merge it. */
    eligible: boolean
    merged: boolean
    error?: string
  }[]
  /** Matches that look equally right for more than one book, left alone. */
  ambiguous: AmbiguousMatch[]
}

export function getLinkLevel(): LinkLevel {
  return process.env["STORYTELLER_AUTO_LINK_LEVEL"] === "probable"
    ? "probable"
    : "high"
}

export async function runBookLinker(
  options: { dryRun?: boolean; level?: LinkLevel } = {},
): Promise<LinkRunResult> {
  const level = options.level ?? getLinkLevel()
  const books = await getBooks()
  const { pairs, ambiguous } = findLinkPlan(books)
  const result: LinkRunResult = {
    considered: books.length,
    level,
    pairs: [],
    ambiguous,
  }

  for (const pair of pairs) {
    const eligible = pair.confidence === "high" || level === "probable"
    const entry: LinkRunResult["pairs"][number] = {
      ebook: pair.ebookBook.title,
      audiobook: pair.audiobookBook.title,
      reason: pair.reason,
      confidence: pair.confidence,
      score: Math.round(pair.score * 100) / 100,
      eligible,
      merged: false,
    }
    if (!options.dryRun && eligible) {
      try {
        await mergePair(pair)
        entry.merged = true
        logger.info(
          `Linked ebook and audiobook of "${entry.ebook}" (${entry.reason}, ${entry.confidence})`,
        )
      } catch (error) {
        entry.error = error instanceof Error ? error.message : String(error)
        logger.error({
          msg: `Failed to link ebook and audiobook of "${entry.ebook}"`,
          err: error,
        })
      }
    }
    result.pairs.push(entry)
  }

  logger.info(
    `Book linker ${options.dryRun ? "(dry run) " : ""}checked ${books.length} books: ${pairs.length} pairs found, ${ambiguous.length} unclear (level: ${level})`,
  )
  return result
}
