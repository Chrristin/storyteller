import {
  baseNormalise,
  normaliseAuthorName,
  normaliseSeriesName,
} from "@/nameKey"
import { cleanTitle } from "@/titleCleanup"

import { normaliseGenres, normaliseMoods } from "./genres"
import {
  type FeaturedSeries,
  type PrimarySeries,
  pickPrimarySeries,
} from "./series"

/**
 * Pure scoring of Hardcover search hits against a library book. No network, no
 * database. The top hit from Hardcover is often wrong (study guides, summaries,
 * box sets, comic adaptations, another book in the same series), so every hit
 * is scored and only a clean one is called "sure".
 */

export type HardcoverDoc = {
  id?: number | string | null
  title?: string | null
  author_names?: string[] | null
  series_names?: string[] | null
  featured_series?: FeaturedSeries
  genres?: string[] | null
  moods?: string[] | null
  alternative_titles?: string[] | null
  compilation?: boolean | null
  users_count?: number | null
  ratings_count?: number | null
  book_category_id?: number | null
}

export type LibraryBookInfo = {
  title: string
  authors: string[]
  /** The book's own existing series names, used to pick between series names. */
  seriesNames?: string[]
  /** The book's positions in its series, to tell a track number from a real title number. */
  seriesPositions?: number[]
}

export type Confidence = "sure" | "check" | "none"

export type MatchSuggestion = {
  hardcoverId: string | null
  matchedTitle: string
  matchedAuthors: string[]
  series: PrimarySeries
  genres: string[]
  moods: string[]
}

export type MatchResult = {
  confidence: Confidence
  score: number
  reasons: string[]
  suggestion: MatchSuggestion | null
}

/** Never acceptable, unless the library book itself is one. */
const NEVER_RE =
  /summary of|study guide|sampler|trivia|workbook|companion|analysis/i
/** Collections. Acceptable only for a library book that is itself one. */
const COLLECTION_RE = /box set|boxed set|collection|omnibus/i
const DRAMA_RE =
  /full[- ]cast|dramati[sz]ation|dramati[sz]ed|audio drama|radio (?:play|drama)/i
const COMIC_GENRES = new Set([
  "comics",
  "graphic novels",
  "comics & graphic novels",
  "manga",
])
const COMIC_TITLE_RE = /graphic novel|comic|manga/i

function stripNoise(title: string) {
  return title.replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
}

function dropArticle(key: string) {
  return key.replace(/^(?:the|a|an) /, "")
}

/** "The Eye of the World (Wheel of Time, #1)" -> "eye of the world" style keys. */
export function normaliseTitle(title: string): string {
  return dropArticle(baseNormalise(stripNoise(title)))
}

/** Same, but without a subtitle after ":" or a dash. */
export function coreTitle(title: string): string {
  const head = stripNoise(title).split(/\s*[:–—]\s+|\s+-\s+/)[0] ?? ""
  const key = dropArticle(baseNormalise(head))
  return key || normaliseTitle(title)
}

function containsWords(haystack: string, needle: string) {
  if (!needle) return false
  return ` ${haystack} `.includes(` ${needle} `)
}

type TitleMatch = "exact" | "partial" | "alternative" | "none"

function matchTitle(book: string, doc: HardcoverDoc): TitleMatch {
  const bookFull = normaliseTitle(book)
  const bookCore = coreTitle(book)
  const docTitle = doc.title ?? ""
  const docFull = normaliseTitle(docTitle)
  const docCore = coreTitle(docTitle)
  if (!bookFull || !docFull) return "none"

  if (bookFull === docFull || (bookCore === docCore && bookCore !== "")) {
    return "exact"
  }
  if (
    containsWords(docFull, bookCore) ||
    containsWords(bookFull, docCore) ||
    containsWords(docFull, bookFull) ||
    containsWords(bookFull, docFull)
  ) {
    return "partial"
  }
  // Alternative titles are noisy (a book can list a neighbour's title), so
  // they only ever give "check".
  for (const alt of doc.alternative_titles ?? []) {
    if (typeof alt !== "string") continue
    const altKey = normaliseTitle(alt)
    if (altKey && (altKey === bookFull || coreTitle(alt) === bookCore)) {
      return "alternative"
    }
  }
  return "none"
}

type AuthorMatch = "strong" | "loose" | "unknown" | "none"

function looselySame(a: string, b: string) {
  const left = a.split(" ").filter(Boolean)
  const right = b.split(" ").filter(Boolean)
  if (left.length === 0 || right.length === 0) return false
  if (left.at(-1) !== right.at(-1)) return false
  // Same last name and the same first letter ("James Corey" and "James S A Corey").
  return left[0]?.[0] === right[0]?.[0]
}

function matchAuthors(
  bookAuthors: readonly string[],
  docAuthors: readonly string[] | null | undefined,
): AuthorMatch {
  const wanted = bookAuthors.map(normaliseAuthorName).filter(Boolean)
  if (wanted.length === 0) return "unknown"
  const found = (docAuthors ?? []).map(normaliseAuthorName).filter(Boolean)
  if (wanted.some((name) => found.includes(name))) return "strong"
  if (wanted.some((a) => found.some((b) => looselySame(a, b)))) return "loose"
  return "none"
}

function isComic(doc: HardcoverDoc) {
  return (doc.genres ?? []).some(
    (genre) =>
      typeof genre === "string" && COMIC_GENRES.has(genre.trim().toLowerCase()),
  )
}

type Candidate = {
  doc: HardcoverDoc
  score: number
  title: TitleMatch
  author: AuthorMatch
  reasons: string[]
  capped: boolean
}

function scoreDoc(book: LibraryBookInfo, doc: HardcoverDoc): Candidate | null {
  const docTitle = doc.title ?? ""
  if (!docTitle) return null
  const reasons: string[] = []
  const bookIsCollection = COLLECTION_RE.test(book.title)

  if (NEVER_RE.test(docTitle) && !NEVER_RE.test(book.title)) return null
  if (
    !bookIsCollection &&
    (COLLECTION_RE.test(docTitle) || doc.compilation === true)
  ) {
    return null
  }

  const author = matchAuthors(book.authors, doc.author_names)
  if (author === "none") return null

  const title = matchTitle(book.title, doc)
  if (title === "none") return null

  let score = { exact: 100, partial: 50, alternative: 40, none: 0 }[title]
  score += { strong: 40, loose: 15, unknown: 10, none: 0 }[author]

  let capped = title !== "exact" || author !== "strong"
  if (title === "partial") reasons.push("The title only partly matches")
  if (title === "alternative") reasons.push("Matched an alternative title")
  if (author === "loose") reasons.push("The author name only loosely matches")
  if (author === "unknown") reasons.push("The book has no author to compare")

  if (isComic(doc) && !COMIC_TITLE_RE.test(`${book.title}`)) {
    score -= 60
    capped = true
    reasons.push("Looks like a comic adaptation")
  }
  if (DRAMA_RE.test(docTitle) !== DRAMA_RE.test(book.title)) {
    score -= 40
    capped = true
    reasons.push("A different edition (audio drama or not)")
  }

  const popularity =
    Math.log10(1 + Math.max(0, doc.users_count ?? 0)) * 2 +
    Math.log10(1 + Math.max(0, doc.ratings_count ?? 0))
  score += popularity

  return { doc, score, title, author, reasons, capped }
}

/**
 * "Percy Jackson and the Olympians: the lightning thief" in the series
 * "Percy Jackson and the Olympians" is the book "the lightning thief". Only a
 * prefix before a colon that equals one of the book's own series names is
 * removed, so a real subtitle is never cut.
 */
export function stripSeriesPrefix(
  title: string,
  seriesNames: readonly string[] = [],
): string {
  const colon = title.indexOf(":")
  if (colon <= 0) return title
  const prefix = normaliseSeriesName(title.slice(0, colon))
  const rest = title.slice(colon + 1).trim()
  if (!prefix || !rest) return title
  const isSeries = seriesNames.some(
    (name) => normaliseSeriesName(name) === prefix,
  )
  return isSeries ? rest : title
}

/**
 * The library title as it should be compared and searched: without
 * "(Unabridged)" noise, a zero padded track number, or a number equal to the
 * series position.
 */
export function cleanLibraryTitle(
  title: string,
  seriesPositions?: readonly number[],
): string {
  return cleanTitle(title, { seriesPositions }).title
}

export function matchBook(
  rawBook: LibraryBookInfo,
  docs: readonly HardcoverDoc[],
): MatchResult {
  const book: LibraryBookInfo = {
    ...rawBook,
    title: stripSeriesPrefix(
      cleanLibraryTitle(rawBook.title, rawBook.seriesPositions),
      rawBook.seriesNames,
    ),
  }
  const candidates = docs
    .map((doc) => scoreDoc(book, doc))
    .filter((candidate): candidate is Candidate => candidate !== null)
    .sort((a, b) => b.score - a.score)

  const best = candidates[0]
  if (!best) {
    return {
      confidence: "none",
      score: 0,
      reasons: ["Nothing on Hardcover matched this title and author"],
      suggestion: null,
    }
  }

  const { doc } = best
  const series = pickPrimarySeries({
    seriesNames: doc.series_names,
    featuredSeries: doc.featured_series,
    existingSeries: book.seriesNames ?? [],
  })

  // A series position that is present must make sense. When there is a
  // featured series with a position that is not valid, we are not sure.
  const rawPosition = doc.featured_series?.position
  const positionCoherent =
    rawPosition === undefined ||
    rawPosition === null ||
    (Number(rawPosition) >= 0 && Number.isFinite(Number(rawPosition)))
  if (!positionCoherent) best.reasons.push("The series position is odd")

  const confidence: Confidence =
    !best.capped && positionCoherent ? "sure" : "check"

  return {
    confidence,
    score: best.score,
    reasons: best.reasons,
    suggestion: {
      hardcoverId:
        doc.id === undefined || doc.id === null ? null : String(doc.id),
      matchedTitle: doc.title ?? "",
      matchedAuthors: (doc.author_names ?? []).filter(
        (name): name is string => typeof name === "string",
      ),
      series,
      genres: normaliseGenres(doc.genres),
      moods: normaliseMoods(doc.moods),
    },
  }
}
