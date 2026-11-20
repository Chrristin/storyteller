/**
 * Automatic author collections for Home. Derived live from the local books,
 * nothing is stored. Authors are grouped by normalised name (so "James S.A
 * Corey" and "James S. A. Corey" are one author), and an author only gets a
 * collection with two or more books. A book with several credited authors is
 * in the collection of each of them.
 */

import {
  chooseCanonical,
  normaliseAuthorName,
  normaliseSeriesName,
} from "./nameKey"
import {
  type Pile,
  type PileBook,
  authorCovers,
  buildPiles,
  keepRealSeries,
} from "./piles"

/** An author collection needs at least this many books. */
export const MIN_AUTHOR_COLLECTION_BOOKS = 2

export interface AuthorCollection<B extends PileBook = PileBook> {
  /** The normalised author name. Stable, used as the route parameter. */
  key: string
  /** The display name (the spelling most books use). */
  name: string
  /** Every book by this author, newest added first. */
  books: B[]
  /** How many different series (spellings merged) the books are in. */
  seriesCount: number
  /** Up to three books to show as covers (the newest added). */
  covers: B[]
}

function time(date: string | Date) {
  const value = new Date(date).valueOf()
  return Number.isNaN(value) ? 0 : value
}

/** Series the books are in that have at least two of them (spellings merged). */
function distinctSeriesCount(books: readonly PileBook[]) {
  const counts = new Map<string, Set<string>>()
  for (const book of books) {
    for (const series of book.series) {
      const key = normaliseSeriesName(series.name)
      if (!key) continue
      const set = counts.get(key) ?? new Set<string>()
      set.add(book.uuid)
      counts.set(key, set)
    }
  }
  return [...counts.values()].filter((set) => set.size >= 2).length
}

/** Every author with two or more books, sorted by name. */
export function buildAuthorCollections<B extends PileBook>(
  books: readonly B[],
): AuthorCollection<B>[] {
  const groups = new Map<
    string,
    {
      books: Map<string, B>
      names: Map<string, { uuid: string; name: string; books: Set<string> }>
    }
  >()

  for (const book of books) {
    for (const author of book.authors) {
      const key = normaliseAuthorName(author.name)
      if (!key) continue
      let group = groups.get(key)
      if (!group) {
        group = { books: new Map(), names: new Map() }
        groups.set(key, group)
      }
      group.books.set(book.uuid, book)
      const spelling = group.names.get(author.name) ?? {
        uuid: author.name,
        name: author.name,
        books: new Set<string>(),
      }
      spelling.books.add(book.uuid)
      group.names.set(author.name, spelling)
    }
  }

  const collections: AuthorCollection<B>[] = []
  for (const [key, group] of groups) {
    if (group.books.size < MIN_AUTHOR_COLLECTION_BOOKS) continue
    const display = chooseCanonical(
      [...group.names.values()].map((entry) => ({
        uuid: entry.uuid,
        name: entry.name,
        books: entry.books.size,
      })),
    )
    const authorBooks = [...group.books.values()].sort(
      (a, b) => time(b.createdAt) - time(a.createdAt),
    )
    collections.push({
      key,
      name: display.name,
      books: authorBooks,
      seriesCount: distinctSeriesCount(authorBooks),
      covers: authorCovers(authorBooks),
    })
  }
  return collections.sort(
    (a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key),
  )
}

/** "12 books" or "12 books, 3 series". */
export function authorCollectionLabel(collection: {
  books: readonly unknown[]
  seriesCount: number
}) {
  const count = collection.books.length
  const books = `${count} ${count === 1 ? "book" : "books"}`
  return collection.seriesCount > 0
    ? `${books}, ${collection.seriesCount} series`
    : books
}

export interface AuthorCollectionDetail<B extends PileBook = PileBook> {
  collection: AuthorCollection<B>
  /** One pile per series the author's books are in. */
  series: Pile<B>[]
  /** The author's books that are in no series. */
  looseBooks: B[]
}

/** What the author screen shows, or null when there is no such collection. */
export function authorCollectionDetail<B extends PileBook>(
  books: readonly B[],
  key: string,
): AuthorCollectionDetail<B> | null {
  const collection = buildAuthorCollections(books).find((c) => c.key === key)
  if (!collection) return null
  // A series with one book and nothing known to be missing is not shown as a
  // series: its book is listed with the loose books instead.
  const series = keepRealSeries(buildPiles(collection.books, "series"))
  const inShownSeries = new Set(
    series.flatMap((pile) => pile.books.map((b) => b.uuid)),
  )
  return {
    collection,
    series,
    looseBooks: collection.books.filter(
      (book) => !inShownSeries.has(book.uuid),
    ),
  }
}
