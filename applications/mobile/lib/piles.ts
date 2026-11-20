import {
  chooseCanonical,
  cleanSeriesDisplayName,
  normaliseAuthorName,
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
  /** Every book in the pile in swipe order (series: position then title; authors: newest added first). */
  books: B[]
  /** How many numbers are missing from a series (always 0 for authors). */
  missing: number
}

function groupKey(kind: PileKind, name: string) {
  return kind === "series"
    ? normaliseSeriesName(name)
    : normaliseAuthorName(name)
}

function compareUuid(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

function time(date: string | Date) {
  const value = new Date(date).valueOf()
  return Number.isNaN(value) ? 0 : value
}

function sortKey(position: number | null | undefined) {
  return isWholePosition(position) ? position : Number.POSITIVE_INFINITY
}

/** Every book by series position (unpositioned last), then title. */
export function orderSeriesBooks<B extends PileBook>(
  books: readonly B[],
  seriesName: string,
): B[] {
  const key = groupKey("series", seriesName)
  const positionOf = (book: B) =>
    book.series.find((s) => groupKey("series", s.name) === key)?.position
  return [...books].sort(
    (a, b) =>
      sortKey(positionOf(a)) - sortKey(positionOf(b)) ||
      a.title.localeCompare(b.title),
  )
}

/** The first three books by series position (unpositioned last), then title. */
export function seriesCovers<B extends PileBook>(
  books: B[],
  seriesName: string,
): B[] {
  return orderSeriesBooks(books, seriesName).slice(0, 3)
}

/** Every book, newest added first. */
export function orderAuthorBooks<B extends PileBook>(books: readonly B[]): B[] {
  return [...books].sort((a, b) => time(b.createdAt) - time(a.createdAt))
}

/** The three books added most recently. */
export function authorCovers<B extends PileBook>(books: B[]): B[] {
  return orderAuthorBooks(books).slice(0, 3)
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

function groupBooks<B extends PileBook>(
  books: B[],
  kind: PileKind,
): Group<B>[] {
  const groups = new Map<
    string,
    { nameKey: string; entries: Map<string, Entry>; books: Map<string, B> }
  >()
  for (const book of books) {
    const refs =
      kind === "series"
        ? book.series.map((s) => ({ uuid: s.uuid, name: s.name }))
        : book.authors.slice(0, 1)
    for (const ref of refs) {
      const nameKey = groupKey(kind, ref.name)
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
  const input: GapSeries[] = groupBooks(books, "series").map((group) => ({
    uuid: group.uuid,
    name: group.name,
    authors: [
      ...new Set(
        group.books.flatMap((b) => b.authors.slice(0, 1).map((a) => a.name)),
      ),
    ],
    books: group.books.flatMap((book) =>
      book.series
        .filter((s) => groupKey("series", s.name) === group.nameKey)
        .map((s) => ({ uuid: book.uuid, position: s.position })),
    ),
  }))
  // One entry per name: the group with the fewest missing wins.
  const gaps = findSeriesGaps(input)
  const picked = new Map<string, SeriesGap>()
  for (const gap of gaps) {
    const key = groupKey("series", gap.name)
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
          groupKey("series", gap.name),
          gap.missing.length,
        ])
      : [],
  )
  const byName = new Map<string, Group<B>[]>()
  for (const group of groupBooks(books, kind)) {
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
    const ordered =
      kind === "series"
        ? orderSeriesBooks(all, display.name)
        : orderAuthorBooks(all)
    piles.push({
      kind,
      uuid: main.uuid,
      name:
        kind === "series" ? cleanSeriesDisplayName(display.name) : display.name,
      count: all.length,
      covers: ordered.slice(0, 3),
      books: ordered,
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
