import { sql } from "kysely"

import {
  type ArchiveRequestGroup,
  type DuplicateCandidate,
  type DuplicateGroup,
  type DuplicatePreview,
  countArchivable,
  groupDuplicates,
  validateArchiveRequest,
} from "@/duplicates"

import { setBooksArchived } from "./books"
import { db } from "./connection"

/**
 * Loads every book that is not archived, with just what the duplicate finder
 * needs. Reads only.
 */
async function loadCandidates(): Promise<DuplicateCandidate[]> {
  const [books, ebooks, audiobooks, authors, series] = await Promise.all([
    db
      .selectFrom("book")
      .select(["uuid", "title", "createdAt"])
      .where("archivedAt", "is", null)
      .execute(),
    db
      .selectFrom("ebook")
      .select(["bookUuid", "filepath", "fileSize"])
      .execute(),
    db
      .selectFrom("audiobook")
      .select(["bookUuid", "filepath", "fileSize"])
      .execute(),
    db
      .selectFrom("bookToCreator")
      .innerJoin("creator", "creator.uuid", "bookToCreator.creatorUuid")
      .select(["bookToCreator.bookUuid", "creator.name"])
      .where("bookToCreator.role", "=", "aut")
      .orderBy(sql`book_to_creator.rowid`)
      .execute(),
    db
      .selectFrom("bookToSeries")
      .innerJoin("series", "series.uuid", "bookToSeries.seriesUuid")
      .select(["bookToSeries.bookUuid", "series.name", "bookToSeries.position"])
      .orderBy("bookToSeries.featured", "desc")
      .orderBy(sql`book_to_series.rowid`)
      .execute(),
  ])

  const ebookBy = new Map(ebooks.map((e) => [e.bookUuid, e]))
  const audioBy = new Map(audiobooks.map((a) => [a.bookUuid, a]))
  const authorsBy = new Map<string, string[]>()
  for (const row of authors) {
    const list = authorsBy.get(row.bookUuid) ?? []
    list.push(row.name)
    authorsBy.set(row.bookUuid, list)
  }
  const seriesBy = new Map<string, { name: string; position: number | null }>()
  for (const row of series) {
    if (!seriesBy.has(row.bookUuid)) {
      seriesBy.set(row.bookUuid, { name: row.name, position: row.position })
    }
  }

  return books.map((book) => {
    const ebook = ebookBy.get(book.uuid)
    const audiobook = audioBy.get(book.uuid)
    return {
      uuid: book.uuid,
      title: book.title,
      authors: authorsBy.get(book.uuid) ?? [],
      createdAt: book.createdAt,
      series: seriesBy.get(book.uuid) ?? null,
      ebook: ebook
        ? { filepath: ebook.filepath, fileSize: ebook.fileSize }
        : null,
      audiobook: audiobook
        ? { filepath: audiobook.filepath, fileSize: audiobook.fileSize }
        : null,
    }
  })
}

export async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
  return groupDuplicates(await loadCandidates())
}

export async function previewDuplicates(
  page: { offset?: number; limit?: number } = {},
): Promise<DuplicatePreview> {
  const all = await findDuplicateGroups()
  const offset = page.offset ?? 0
  return {
    totalGroups: all.length,
    booksToArchive: countArchivable(all),
    groups: all.slice(offset, page.limit ? offset + page.limit : undefined),
  }
}

export type ArchiveDuplicatesResult =
  | { ok: true; archived: number; groups: number }
  | { ok: false; error: string }

/**
 * Archives the chosen duplicates. The groups are computed again here and every
 * book must still sit in a group with its keeper, so a stale or hand-made
 * request cannot archive an unrelated book.
 */
export async function archiveDuplicates(
  requested: ArchiveRequestGroup[],
): Promise<ArchiveDuplicatesResult> {
  const groups = await findDuplicateGroups()
  const validated = validateArchiveRequest(requested, groups)
  if (!validated.ok) return validated

  const changed = await setBooksArchived(
    validated.uuids as Parameters<typeof setBooksArchived>[0],
    true,
  )
  return {
    ok: true,
    archived: changed.length,
    groups: requested.filter((g) => g.archiveUuids.length > 0).length,
  }
}
