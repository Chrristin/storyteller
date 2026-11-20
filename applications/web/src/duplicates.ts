import { baseNormalise, normaliseAuthorName } from "@/nameKey"

/**
 * Finds books that are the same book twice: same format, same normalised
 * title and same author. Pure, so it can be tested without a database. The
 * server loads the books and calls `groupDuplicates`.
 */

export type DuplicateFormat = "ebook" | "audiobook"

export type DuplicateCandidate = {
  uuid: string
  title: string
  /** author names, the first one is the primary author */
  authors: string[]
  createdAt: string
  archivedAt?: string | null
  /** main series name and position, used to keep series entries apart */
  series?: { name: string; position: number | null } | null
  ebook?: { filepath: string; fileSize: number | null } | null
  audiobook?: { filepath: string; fileSize: number | null } | null
}

export type DuplicateBook = {
  uuid: string
  title: string
  authors: string[]
  formats: DuplicateFormat[]
  ebookPath: string | null
  audiobookPath: string | null
  ebookSize: number | null
  audiobookSize: number | null
  createdAt: string
}

export type DuplicateGroup = {
  /** stable key: format, title key and author key */
  key: string
  /** "Title · Author · format" */
  name: string
  format: DuplicateFormat
  keeperUuid: string
  books: DuplicateBook[]
}

export type DuplicatePreview = {
  totalGroups: number
  booksToArchive: number
  groups: DuplicateGroup[]
}

const ARTICLES = new Set(["the", "a", "an"])

const EDITION_MODIFIERS = [
  "enhanced",
  "illustrated",
  "annotated",
  "revised",
  "expanded",
  "updated",
  "anniversary",
  "collectors",
  "collector s",
  "special",
  "deluxe",
  "definitive",
  "complete",
  "new",
  "kindle",
  "ebook",
  "movie tie in",
  "original",
  "international",
  "mass market",
  "large print",
  "paperback",
  "hardcover",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "\\d+(?:st|nd|rd|th)",
  "\\d+th anniversary",
]

const TRAILING_EDITION = new RegExp(
  ` (?:(?:${EDITION_MODIFIERS.join("|")}) )*edition$`,
)
const TRAILING_FORMAT_WORD = / (?:unabridged|abridged|illustrated|annotated)$/

// parentheses that name a series entry ("Book 2", "Vol. 3", "#1") are kept
const SERIES_NUMBER_IN_PARENS =
  /(?:\b(?:book|vol|volume|part|no|nr|number)\b\.?\s*\d|#\s*\d)/i

/**
 * Removes the noise editions add to a title: bracketed text ("[ill. Lee]"),
 * publisher and year brackets ("(HarperCollins, 2012)"), "(Unabridged)" and
 * trailing edition words ("Enhanced Edition"). Numbers are never removed, so
 * "Book 1" and "Book 2" stay different.
 */
export function titleKey(title: string): string {
  let text = title
  // square and curly brackets always go
  text = text.replace(/\[[^\]]*\]|\{[^}]*\}/g, " ")
  // round brackets go unless they hold a series number
  text = text.replace(/\(([^)]*)\)/g, (_match, inner: string) =>
    SERIES_NUMBER_IN_PARENS.test(inner) ? ` ${inner} ` : " ",
  )

  let key = baseNormalise(text.replace(/_/g, " "))

  for (let i = 0; i < 3; i++) {
    const before = key
    key = key.replace(TRAILING_EDITION, "").replace(TRAILING_FORMAT_WORD, "")
    if (key === before) break
  }

  const words = key.split(" ").filter(Boolean)
  while (words.length > 1 && ARTICLES.has(words[0] ?? "")) words.shift()
  return words.join(" ")
}

function formatsOf(book: DuplicateCandidate): DuplicateFormat[] {
  const formats: DuplicateFormat[] = []
  if (book.ebook) formats.push("ebook")
  if (book.audiobook) formats.push("audiobook")
  return formats
}

function sizeFor(book: DuplicateCandidate, format: DuplicateFormat) {
  return (format === "ebook" ? book.ebook : book.audiobook)?.fileSize ?? 0
}

function toDuplicateBook(book: DuplicateCandidate): DuplicateBook {
  return {
    uuid: book.uuid,
    title: book.title,
    authors: book.authors,
    formats: formatsOf(book),
    ebookPath: book.ebook?.filepath ?? null,
    audiobookPath: book.audiobook?.filepath ?? null,
    ebookSize: book.ebook?.fileSize ?? null,
    audiobookSize: book.audiobook?.fileSize ?? null,
    createdAt: book.createdAt,
  }
}

/** The largest file of the compared format, then the newest, then the uuid. */
export function chooseKeeper(
  books: DuplicateCandidate[],
  format: DuplicateFormat,
): DuplicateCandidate {
  const sorted = [...books].sort(
    (a, b) =>
      sizeFor(b, format) - sizeFor(a, format) ||
      (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0) ||
      (a.uuid < b.uuid ? -1 : 1),
  )
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return sorted[0]!
}

/**
 * Splits a same-title group by series position, so two entries of a series
 * that happen to share a title are not merged. Books without a position join
 * only when all positioned books agree.
 */
function splitBySeriesPosition(
  books: DuplicateCandidate[],
): DuplicateCandidate[][] {
  const positions = new Set<number>()
  for (const book of books) {
    if (book.series?.position != null) positions.add(book.series.position)
  }
  if (positions.size <= 1) return [books]

  const buckets = new Map<number, DuplicateCandidate[]>()
  for (const book of books) {
    const position = book.series?.position
    if (position == null) continue
    const bucket = buckets.get(position) ?? []
    bucket.push(book)
    buckets.set(position, bucket)
  }
  return [...buckets.values()]
}

export function groupDuplicates(
  candidates: DuplicateCandidate[],
): DuplicateGroup[] {
  const byKey = new Map<string, DuplicateCandidate[]>()

  for (const book of candidates) {
    if (book.archivedAt) continue

    const author = book.authors[0] ? normaliseAuthorName(book.authors[0]) : ""
    const title = titleKey(book.title)
    // without an author or a title there is nothing safe to compare
    if (!author || !title) continue

    for (const format of formatsOf(book)) {
      const key = `${format}|${title}|${author}`
      const list = byKey.get(key) ?? []
      list.push(book)
      byKey.set(key, list)
    }
  }

  const groups: DuplicateGroup[] = []
  for (const [key, books] of byKey) {
    if (books.length < 2) continue
    const format = key.split("|")[0] as DuplicateFormat

    const subgroups = splitBySeriesPosition(books)
    subgroups.forEach((subgroup, index) => {
      if (subgroup.length < 2) return
      const keeper = chooseKeeper(subgroup, format)
      const ordered = [
        keeper,
        ...subgroup
          .filter((b) => b.uuid !== keeper.uuid)
          .sort((a, b) => sizeFor(b, format) - sizeFor(a, format)),
      ]
      const position = subgroup[0]?.series?.position
      groups.push({
        key: subgroups.length > 1 ? `${key}|${position ?? index}` : key,
        name: `${keeper.title} · ${keeper.authors[0] ?? ""} · ${format}`,
        format,
        keeperUuid: keeper.uuid,
        books: ordered.map(toDuplicateBook),
      })
    })
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name))
}

/** How many books the default choice would archive. */
export function countArchivable(groups: DuplicateGroup[]): number {
  const uuids = new Set<string>()
  for (const group of groups) {
    for (const book of group.books) {
      if (book.uuid !== group.keeperUuid) uuids.add(book.uuid)
    }
  }
  return uuids.size
}

export type ArchiveRequestGroup = {
  keeperUuid: string
  archiveUuids: string[]
}

/**
 * Checks an archive request against freshly computed groups. Every uuid to
 * archive must sit in a group with its keeper, and a book that is kept in one
 * group is never archived through another. Returns the uuids to archive, or
 * the reason the request is refused.
 */
export function validateArchiveRequest(
  requested: ArchiveRequestGroup[],
  groups: DuplicateGroup[],
): { ok: true; uuids: string[] } | { ok: false; error: string } {
  const keepers = new Set(requested.map((g) => g.keeperUuid))
  const uuids = new Set<string>()

  for (const request of requested) {
    for (const uuid of request.archiveUuids) {
      if (keepers.has(uuid)) {
        return { ok: false, error: `Book ${uuid} is kept in another group` }
      }
      if (uuid === request.keeperUuid) {
        return { ok: false, error: "A book cannot be archived and kept" }
      }
      const together = groups.some(
        (group) =>
          group.books.some((b) => b.uuid === request.keeperUuid) &&
          group.books.some((b) => b.uuid === uuid),
      )
      if (!together) {
        return {
          ok: false,
          error: `Book ${uuid} is not a duplicate of ${request.keeperUuid}`,
        }
      }
      uuids.add(uuid)
    }
  }

  return { ok: true, uuids: [...uuids] }
}
