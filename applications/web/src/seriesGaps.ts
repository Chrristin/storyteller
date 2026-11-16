/**
 * Finds series that look like they are missing books: the owned positions are
 * whole numbers with holes between the lowest and the highest one.
 *
 * Only whole numbers from 1 up count. Null, 0 and fractional positions (a
 * novella at 2.5) are ignored. Several books at one position (editions) count
 * once. Nothing is guessed beyond the highest owned position.
 */
export type GapSeriesInput = {
  uuid: string
  name: string
  authors: string[]
  books: { bookUuid: string; position: number | null }[]
}

export type SeriesGap = {
  uuid: string
  name: string
  authors: string[]
  owned: number[]
  missing: number[]
  upTo: number
}

export function findSeriesGaps(series: GapSeriesInput[]): SeriesGap[] {
  const gaps: SeriesGap[] = []

  for (const s of series) {
    const positions = new Set<number>()
    for (const book of s.books) {
      const p = book.position
      if (p !== null && Number.isInteger(p) && p >= 1) positions.add(p)
    }
    if (positions.size < 2) continue

    const owned = [...positions].sort((a, b) => a - b)
    const first = owned[0] as number
    const last = owned[owned.length - 1] as number
    const missing: number[] = []
    for (let n = first + 1; n < last; n++) {
      if (!positions.has(n)) missing.push(n)
    }
    if (missing.length === 0) continue

    gaps.push({
      uuid: s.uuid,
      name: s.name,
      authors: s.authors,
      owned,
      missing,
      upTo: last,
    })
  }

  return gaps.sort(
    (a, b) =>
      b.missing.length - a.missing.length || a.name.localeCompare(b.name),
  )
}
