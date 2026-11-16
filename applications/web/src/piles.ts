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
  seriesUuid: string,
): B[] {
  const positionOf = (book: B) =>
    book.series.find((s) => s.uuid === seriesUuid)?.position
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
 * Groups books into piles by series, or by first author. Sorted by name.
 * `missingBySeries` maps a series uuid to its number of missing books.
 */
export function buildPiles<B extends PileBook>(
  books: B[],
  kind: PileKind,
  missingBySeries: ReadonlyMap<string, number> = new Map(),
): Pile<B>[] {
  const groups = new Map<string, { name: string; books: B[] }>()
  for (const book of books) {
    const refs =
      kind === "series"
        ? book.series.map((s) => ({ uuid: s.uuid, name: s.name }))
        : book.authors.slice(0, 1)
    for (const ref of refs) {
      if (!ref.name.trim()) continue
      const group = groups.get(ref.uuid)
      if (group) group.books.push(book)
      else groups.set(ref.uuid, { name: ref.name, books: [book] })
    }
  }

  return [...groups]
    .map(([uuid, group]) => ({
      kind,
      uuid,
      name: group.name,
      count: group.books.length,
      covers:
        kind === "series"
          ? seriesCovers(group.books, uuid)
          : authorCovers(group.books),
      missing: kind === "series" ? (missingBySeries.get(uuid) ?? 0) : 0,
    }))
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
