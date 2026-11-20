/**
 * Finds the numbers missing from a series, using only the books the person
 * owns. Pure, so it works offline and is easy to test.
 *
 * Rules:
 * - Only whole-number positions of 1 or more count. Null, 0 and fractions
 *   (novellas such as 2.5) are ignored.
 * - Several books at the same position count once.
 * - A series needs at least two different whole positions to be judged.
 * - The gaps are the whole numbers between the lowest and the highest owned
 *   position that are not owned. It never guesses beyond the highest one.
 */

export interface GapSeries {
  uuid: string
  name: string
  books: { uuid: string; position: number | null | undefined }[]
}

export interface SeriesGap {
  uuid: string
  name: string
  /** The distinct whole positions owned, ascending. */
  owned: number[]
  /** The whole positions missing between the lowest and highest owned. */
  missing: number[]
  /** The highest owned position. */
  upTo: number
}

export function isWholePosition(
  position: number | null | undefined,
): position is number {
  return (
    typeof position === "number" && Number.isInteger(position) && position >= 1
  )
}

/** The gaps in a list of positions, or null when there is nothing to judge. */
export function gapsInPositions(
  positions: (number | null | undefined)[],
): { owned: number[]; missing: number[]; upTo: number } | null {
  const owned = [...new Set(positions.filter(isWholePosition))].sort(
    (a, b) => a - b,
  )
  const first = owned[0]
  const last = owned[owned.length - 1]
  if (first === undefined || last === undefined || owned.length < 2) {
    return null
  }
  const have = new Set(owned)
  const missing: number[] = []
  for (let n = first + 1; n < last; n++) {
    if (!have.has(n)) missing.push(n)
  }
  return { owned, missing, upTo: last }
}

export function findSeriesGaps(series: GapSeries[]): SeriesGap[] {
  const result: SeriesGap[] = []
  for (const s of series) {
    const gaps = gapsInPositions(s.books.map((b) => b.position))
    if (!gaps || gaps.missing.length === 0) continue
    result.push({
      uuid: s.uuid,
      name: s.name,
      owned: gaps.owned,
      missing: gaps.missing,
      upTo: gaps.upTo,
    })
  }
  return result.sort(
    (a, b) =>
      a.missing.length - b.missing.length || a.name.localeCompare(b.name),
  )
}
