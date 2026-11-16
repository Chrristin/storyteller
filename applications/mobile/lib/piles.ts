import {
  type GapSeries,
  type SeriesGap,
  findSeriesGaps,
  isWholePosition,
} from "./seriesGaps"

/** The parts of a book that piles need. `BookWithRelations` fits this. */
export interface PileBook {
  uuid: string
  title: string
  createdAt: string | Date
  serverUuid: string | null
  authors: { uuid: string; name: string }[]
  series: { uuid: string; name: string; position: number | null }[]
}

export type PileKind = "series" | "author"

export interface Pile<B extends PileBook = PileBook> {
  kind: PileKind
  /** Series or author uuid to open (the biggest group when several servers). */
  uuid: string
  name: string
  /** How many books, without counting the same book twice. */
  count: number
  /** Up to three books to show as covers. */
  covers: B[]
  /** How many numbers are missing from a series (always 0 for authors). */
  missing: number
}

function nameKey(name: string) {
  return name.trim().toLowerCase()
}

function time(date: string | Date) {
  const value = new Date(date).valueOf()
  return Number.isNaN(value) ? 0 : value
}

function sortKey(position: number | null | undefined) {
  return isWholePosition(position) ? position : Number.POSITIVE_INFINITY
}

/** The first three books by series position (unpositioned last), then title. */
export function seriesCovers<B extends PileBook>(
  books: B[],
  seriesName: string,
): B[] {
  const positionOf = (book: B) =>
    book.series.find((s) => nameKey(s.name) === nameKey(seriesName))?.position
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

interface Group<B extends PileBook> {
  /** Server plus group id, so the same uuid on two servers never collides. */
  key: string
  uuid: string
  name: string
  books: B[]
}

function groupBooks<B extends PileBook>(
  books: B[],
  kind: PileKind,
): Group<B>[] {
  const groups = new Map<string, Group<B>>()
  for (const book of books) {
    const refs =
      kind === "series"
        ? book.series.map((s) => ({ uuid: s.uuid, name: s.name }))
        : book.authors.slice(0, 1)
    for (const ref of refs) {
      if (!ref.name.trim()) continue
      const key = `${book.serverUuid ?? "local"}:${ref.uuid}`
      const group = groups.get(key)
      if (group) group.books.push(book)
      else
        groups.set(key, { key, uuid: ref.uuid, name: ref.name, books: [book] })
    }
  }
  return [...groups.values()]
}

/** Gaps per group, then one entry per series name (the one with fewest missing). */
export function buildMissing<B extends PileBook>(books: B[]): SeriesGap[] {
  const input: GapSeries[] = groupBooks(books, "series").map((group) => ({
    uuid: group.uuid,
    name: group.name,
    authors: [
      ...new Set(
        group.books.flatMap((b) => b.authors.slice(0, 1).map((a) => a.name)),
      ),
    ],
    books: group.books.map((book) => ({
      uuid: book.uuid,
      position: book.series.find((s) => s.uuid === group.uuid)?.position,
    })),
  }))
  // One entry per name: the group with the fewest missing wins.
  const gaps = findSeriesGaps(input)
  const picked = new Map<string, SeriesGap>()
  for (const gap of gaps) {
    const key = nameKey(gap.name)
    const current = picked.get(key)
    if (!current || gap.missing.length < current.missing.length) {
      picked.set(key, gap)
    }
  }
  return [...picked.values()].sort(
    (a, b) =>
      a.missing.length - b.missing.length || a.name.localeCompare(b.name),
  )
}

export function buildPiles<B extends PileBook>(
  books: B[],
  kind: PileKind,
): Pile<B>[] {
  const missingByName = new Map(
    kind === "series"
      ? buildMissing(books).map((gap) => [
          nameKey(gap.name),
          gap.missing.length,
        ])
      : [],
  )
  const byName = new Map<string, Group<B>[]>()
  for (const group of groupBooks(books, kind)) {
    const key = nameKey(group.name)
    byName.set(key, [...(byName.get(key) ?? []), group])
  }

  const piles: Pile<B>[] = []
  for (const [key, groups] of byName) {
    const unique = new Map<string, B>()
    for (const group of groups) {
      for (const book of group.books) unique.set(book.uuid, book)
    }
    const main = groups.reduce((a, b) =>
      b.books.length > a.books.length ? b : a,
    )
    const all = [...unique.values()]
    piles.push({
      kind,
      uuid: main.uuid,
      name: main.name,
      count: all.length,
      covers:
        kind === "series" ? seriesCovers(all, main.name) : authorCovers(all),
      missing: missingByName.get(key) ?? 0,
    })
  }
  return piles.sort((a, b) => a.name.localeCompare(b.name))
}
