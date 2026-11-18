/**
 * Pure helper for the series page placeholders: lays out the books of one
 * series with a dashed slot for each missing number.
 */
function isWholePosition(
  position: number | null | undefined,
): position is number {
  return (
    typeof position === "number" && Number.isInteger(position) && position >= 1
  )
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
