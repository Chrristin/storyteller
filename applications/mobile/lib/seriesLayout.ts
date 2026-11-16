import { gapsInPositions } from "./seriesGaps"

export type SeriesItem<B> =
  | { type: "book"; book: B }
  | { type: "gap"; position: number }

/**
 * The books of one series in series order, with a gap item where a whole
 * number between the lowest and highest owned position is not owned.
 * Books with no position go last. A series without gaps has no gap items.
 */
export function layoutSeries<B extends { title: string }>(
  books: B[],
  positionOf: (book: B) => number | null | undefined,
): SeriesItem<B>[] {
  const sortValue = (book: B) => {
    const position = positionOf(book)
    return typeof position === "number" && Number.isFinite(position)
      ? position
      : Number.POSITIVE_INFINITY
  }
  const items: { value: SeriesItem<B>; at: number }[] = books.map((book) => ({
    value: { type: "book", book },
    at: sortValue(book),
  }))
  const gaps = gapsInPositions(books.map(positionOf))
  for (const position of gaps?.missing ?? []) {
    items.push({ value: { type: "gap", position }, at: position })
  }
  return items
    .sort((a, b) => {
      if (a.at !== b.at) return a.at < b.at ? -1 : 1
      const titleA = a.value.type === "book" ? a.value.book.title : ""
      const titleB = b.value.type === "book" ? b.value.book.title : ""
      return titleA.localeCompare(titleB)
    })
    .map((item) => item.value)
}
