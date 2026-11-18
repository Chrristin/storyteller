import {
  chooseCanonical,
  cleanSeriesDisplayName,
  normaliseAuthorName,
  normaliseSeriesName,
} from "@/nameKey"

/**
 * Pure helpers for the Piles page and the series page placeholders.
 */
export type PileBook = {
  uuid: string
  title: string
  createdAt: string | Date
  authors: { uuid: string; name: string }[]
  series: { uuid: string; name: string; position: number | null }[]
}

export type PileKind = "series" | "author"

export type Pile<B extends PileBook = PileBook> = {
  kind: PileKind
  uuid: string
  name: string
  count: number
  /** Up to three books to show as covers, front cover first. */
  covers: B[]
  /** How many whole numbers are missing from a series. Always 0 for authors. */
  missing: number
}

function isWholePosition(
  position: number | null | undefined,
): position is number {
  return (
    typeof position === "number" && Number.isInteger(position) && position >= 1
  )
}

function sortKey(position: number | null | undefined) {
  return isWholePosition(position) ? position : Number.POSITIVE_INFINITY
}

function time(date: string | Date) {
  const value = new Date(date).valueOf()
  return Number.isNaN(value) ? 0 : value
}

/** The first three books by series position (unpositioned last), then title. */
export function seriesCovers<B extends PileBook>(
  books: B[],
  seriesUuid: string | ReadonlySet<string>,
): B[] {
  const uuids =
    typeof seriesUuid === "string" ? new Set([seriesUuid]) : seriesUuid
  const positionOf = (book: B) =>
    book.series.find((s) => uuids.has(s.uuid))?.position
  return [...books]
    .sort(
      (a, b) =>
        sortKey(positionOf(a)) - sortKey(positionOf(b)) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 3)
}

/** The three books added most recently. */
export function authorCovers<B extends PileBook>(books: B[]): B[] {
  return [...books]
    .sort((a, b) => time(b.createdAt) - time(a.createdAt))
    .slice(0, 3)
}

/**
 * Groups books into piles by series, or by first author. Entries are grouped by
 * their normalised name, so spellings of one name share a pile. The pile uuid
 * is the entry with the most books (tie: smallest uuid), which is also the
 * series the missing counts are keyed by. Sorted by name.
 * `missingBySeries` maps a series uuid to its number of missing books.
 */
export function buildPiles<B extends PileBook>(
  books: B[],
  kind: PileKind,
  missingBySeries: ReadonlyMap<string, number> = new Map(),
): Pile<B>[] {
  const normalise =
    kind === "series" ? normaliseSeriesName : normaliseAuthorName
  type Entry = { uuid: string; name: string; books: Map<string, B> }
  const groups = new Map<
    string,
    { entries: Map<string, Entry>; books: Map<string, B> }
  >()
  for (const book of books) {
    const refs =
      kind === "series"
        ? book.series.map((s) => ({ uuid: s.uuid, name: s.name }))
        : book.authors.slice(0, 1)
    for (const ref of refs) {
      const key = normalise(ref.name)
      if (!key) continue
      let group = groups.get(key)
      if (!group) {
        group = { entries: new Map(), books: new Map() }
        groups.set(key, group)
      }
      let entry = group.entries.get(ref.uuid)
      if (!entry) {
        entry = { uuid: ref.uuid, name: ref.name, books: new Map() }
        group.entries.set(ref.uuid, entry)
      }
      entry.books.set(book.uuid, book)
      group.books.set(book.uuid, book)
    }
  }

  return [...groups.values()]
    .map((group) => {
      const entries = [...group.entries.values()]
      const representative = [...entries].sort(
        (a, b) =>
          b.books.size - a.books.size ||
          (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0),
      )[0] as Entry
      const display = chooseCanonical(
        entries.map((e) => ({
          uuid: e.uuid,
          name: e.name,
          books: e.books.size,
        })),
      )
      const all = [...group.books.values()]
      return {
        kind,
        uuid: representative.uuid,
        name:
          kind === "series"
            ? cleanSeriesDisplayName(display.name)
            : display.name,
        count: all.length,
        covers:
          kind === "series"
            ? seriesCovers(all, new Set(entries.map((e) => e.uuid)))
            : authorCovers(all),
        missing:
          kind === "series"
            ? (missingBySeries.get(representative.uuid) ?? 0)
            : 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export type GridSlot<B> =
  | { type: "book"; book: B; bookIndex: number }
  | { type: "gap"; position: number }

/**
 * Lays out the books of one series in order with a placeholder slot for each
 * missing whole number. `books` must already be sorted by series position,
 * ascending. A placeholder goes just before the first book with a higher
 * position. When more pages of books may still load, placeholders after the
 * last loaded book wait until those pages arrive.
 */
export function buildGridSlots<
  B extends { series: { uuid: string; position: number | null }[] },
>(
  books: B[],
  seriesUuid: string,
  missing: readonly number[],
  hasMore = false,
): GridSlot<B>[] {
  const pending = [...missing].sort((a, b) => a - b)
  const slots: GridSlot<B>[] = []
  let next = 0

  const flushBelow = (limit: number) => {
    while (next < pending.length && (pending[next] as number) < limit) {
      slots.push({ type: "gap", position: pending[next] as number })
      next++
    }
  }

  books.forEach((book, bookIndex) => {
    const position = book.series.find((s) => s.uuid === seriesUuid)?.position
    if (isWholePosition(position)) flushBelow(position)
    slots.push({ type: "book", book, bookIndex })
  })
  if (!hasMore) flushBelow(Number.POSITIVE_INFINITY)

  return slots
}
