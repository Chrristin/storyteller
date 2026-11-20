import {
  chooseCanonical,
  cleanSeriesDisplayName,
  normaliseSeriesName,
} from "./nameKey"
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

export interface Pile<B extends PileBook = PileBook> {
  /** Series uuid to open (the biggest group when several servers). */
  uuid: string
  name: string
  /** How many books, without counting the same book twice. */
  count: number
  /** Every book in the pile in swipe order (position, then title). */
  books: B[]
  /** How many numbers are missing from the series. */
  missing: number
}

function compareUuid(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

function sortKey(position: number | null | undefined) {
  return isWholePosition(position) ? position : Number.POSITIVE_INFINITY
}

/** Every book by series position (unpositioned last), then title. */
function orderSeriesBooks<B extends PileBook>(
  books: readonly B[],
  seriesName: string,
): B[] {
  const key = normaliseSeriesName(seriesName)
  const positionOf = (book: B) =>
    book.series.find((s) => normaliseSeriesName(s.name) === key)?.position
  return [...books].sort(
    (a, b) =>
      sortKey(positionOf(a)) - sortKey(positionOf(b)) ||
      a.title.localeCompare(b.title),
  )
}

interface Entry {
  uuid: string
  name: string
  books: Set<string>
}

interface Group<B extends PileBook> {
  /** Server plus normalised name, so groups on two servers stay apart. */
  key: string
  /** The normalised name shared by everything in the group. */
  nameKey: string
  /** The entry with the most books (tie: smallest uuid). */
  uuid: string
  /** The display name of the group. */
  name: string
  entries: Entry[]
  books: B[]
}

function groupBooks<B extends PileBook>(books: B[]): Group<B>[] {
  const groups = new Map<
    string,
    { nameKey: string; entries: Map<string, Entry>; books: Map<string, B> }
  >()
  for (const book of books) {
    for (const ref of book.series) {
      const nameKey = normaliseSeriesName(ref.name)
      if (!nameKey) continue
      const key = `${book.serverUuid ?? "local"}:${nameKey}`
      let group = groups.get(key)
      if (!group) {
        group = { nameKey, entries: new Map(), books: new Map() }
        groups.set(key, group)
      }
      let entry = group.entries.get(ref.uuid)
      if (!entry) {
        entry = { uuid: ref.uuid, name: ref.name, books: new Set() }
        group.entries.set(ref.uuid, entry)
      }
      entry.books.add(book.uuid)
      group.books.set(book.uuid, book)
    }
  }
  return [...groups].map(([key, group]) => {
    const entries = [...group.entries.values()]
    const main = [...entries].sort(
      (a, b) => b.books.size - a.books.size || compareUuid(a.uuid, b.uuid),
    )[0] as Entry
    const display = chooseCanonical(
      entries.map((e) => ({ uuid: e.uuid, name: e.name, books: e.books.size })),
    )
    return {
      key,
      nameKey: group.nameKey,
      uuid: main.uuid,
      name: display.name,
      entries,
      books: [...group.books.values()],
    }
  })
}

/**
 * Gaps per group (spellings of one name merged, positions unioned), then one
 * entry per series name (the one with fewest missing across servers).
 */
export function buildMissing<B extends PileBook>(books: B[]): SeriesGap[] {
  const input: GapSeries[] = groupBooks(books).map((group) => ({
    uuid: group.uuid,
    name: group.name,
    books: group.books.flatMap((book) =>
      book.series
        .filter((s) => normaliseSeriesName(s.name) === group.nameKey)
        .map((s) => ({ uuid: book.uuid, position: s.position })),
    ),
  }))
  // One entry per name: the group with the fewest missing wins.
  const gaps = findSeriesGaps(input)
  const picked = new Map<string, SeriesGap>()
  for (const gap of gaps) {
    const key = normaliseSeriesName(gap.name)
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

export function buildPiles<B extends PileBook>(books: B[]): Pile<B>[] {
  const missingByName = new Map(
    buildMissing(books).map((gap) => [
      normaliseSeriesName(gap.name),
      gap.missing.length,
    ]),
  )
  const byName = new Map<string, Group<B>[]>()
  for (const group of groupBooks(books)) {
    byName.set(group.nameKey, [...(byName.get(group.nameKey) ?? []), group])
  }

  const piles: Pile<B>[] = []
  for (const [key, groups] of byName) {
    const unique = new Map<string, B>()
    for (const group of groups) {
      for (const book of group.books) unique.set(book.uuid, book)
    }
    const main = groups.reduce((a, b) =>
      b.books.length > a.books.length ||
      (b.books.length === a.books.length && compareUuid(b.uuid, a.uuid) < 0)
        ? b
        : a,
    )
    const display = chooseCanonical(
      groups.flatMap((g) =>
        g.entries.map((e) => ({
          uuid: `${g.key}:${e.uuid}`,
          name: e.name,
          books: e.books.size,
        })),
      ),
    )
    const all = [...unique.values()]
    piles.push({
      uuid: main.uuid,
      name: cleanSeriesDisplayName(display.name),
      count: all.length,
      books: orderSeriesBooks(all, display.name),
      missing: missingByName.get(key) ?? 0,
    })
  }
  return piles.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Series worth showing: one with more than one book, one whose numbers show
 * that other books are missing, or one whose only book is numbered 2 or higher
 * (book 3 of a series means books 1 and 2 exist somewhere). A lone book in a
 * series of one is left out.
 */
export function keepRealSeries<B extends PileBook>(
  piles: Pile<B>[],
): Pile<B>[] {
  return piles.filter((pile) => {
    if (pile.count >= 2 || pile.missing > 0) return true
    const key = normaliseSeriesName(pile.name)
    return pile.books.some((book) =>
      book.series.some(
        (s) =>
          normaliseSeriesName(s.name) === key &&
          typeof s.position === "number" &&
          Number.isInteger(s.position) &&
          s.position >= 2,
      ),
    )
  })
}
