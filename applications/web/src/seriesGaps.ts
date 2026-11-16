import { normaliseSeriesName } from "@/nameKey"

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

/**
 * Merges series whose normalised names are equal, so two spellings of one
 * series are judged together. Positions are unioned (a book counts once), the
 * name and uuid are the representative's (most books, then smallest uuid) and
 * the authors are unioned.
 */
export function mergeSeriesByName(series: GapSeriesInput[]): GapSeriesInput[] {
  const groups = new Map<string, GapSeriesInput[]>()
  const order: GapSeriesInput[][] = []
  for (const s of series) {
    const key = normaliseSeriesName(s.name)
    if (!key) {
      order.push([s])
      continue
    }
    const list = groups.get(key)
    if (list) list.push(s)
    else {
      const created = [s]
      groups.set(key, created)
      order.push(created)
    }
  }

  return order.map((group) => {
    if (group.length === 1) return group[0] as GapSeriesInput
    const count = (s: GapSeriesInput) =>
      new Set(s.books.map((b) => b.bookUuid)).size
    const rep = [...group].sort(
      (a, b) =>
        count(b) - count(a) || (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0),
    )[0] as GapSeriesInput
    const seen = new Set<string>()
    const books: GapSeriesInput["books"] = []
    for (const s of group) {
      for (const book of s.books) {
        const id = `${book.bookUuid}:${String(book.position)}`
        if (seen.has(id)) continue
        seen.add(id)
        books.push(book)
      }
    }
    const authors = [...new Set(group.flatMap((s) => s.authors))].sort((a, b) =>
      a.localeCompare(b),
    )
    return { uuid: rep.uuid, name: rep.name, authors, books }
  })
}
