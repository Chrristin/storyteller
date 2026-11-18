import assert from "node:assert/strict"

import { test } from "vitest"

import {
  authorCollectionDetail,
  authorCollectionLabel,
  buildAuthorCollections,
} from "./authorCollections"
import { type PileBook } from "./piles"

let counter = 0
function book(
  title: string,
  authors: string[],
  series: { name: string; position: number | null }[] = [],
  createdAt = "2024-01-01T00:00:00Z",
): PileBook {
  counter += 1
  return {
    uuid: `book-${counter}`,
    title,
    createdAt,
    serverUuid: "server-1",
    authors: authors.map((name) => ({ uuid: `a-${name}`, name })),
    series: series.map((s) => ({
      uuid: `s-${s.name}`,
      name: s.name,
      position: s.position,
    })),
  }
}

test("spelling variants of one author merge", () => {
  const books = [
    book("Leviathan Wakes", ["James S.A Corey"]),
    book("Caliban's War", ["James S. A. Corey"]),
    book("Abaddon's Gate", ["James S. A. Corey"]),
  ]
  const result = buildAuthorCollections(books)
  assert.equal(result.length, 1)
  assert.equal(result[0]?.books.length, 3)
  assert.equal(result[0]?.name, "James S. A. Corey")
})

test("an author with one book has no collection", () => {
  const books = [
    book("A", ["One Book"]),
    book("B", ["Two Books"]),
    book("C", ["Two Books"]),
  ]
  assert.deepEqual(
    buildAuthorCollections(books).map((c) => c.name),
    ["Two Books"],
  )
})

test("a co-authored book appears under each author", () => {
  const books = [
    book("Good Omens", ["Terry Pratchett", "Neil Gaiman"]),
    book("Mort", ["Terry Pratchett"]),
    book("Coraline", ["Neil Gaiman"]),
  ]
  const result = buildAuthorCollections(books)
  assert.deepEqual(
    result.map((c) => [c.name, c.books.length]),
    [
      ["Neil Gaiman", 2],
      ["Terry Pratchett", 2],
    ],
  )
})

test("a single shared pen name stays under that name only", () => {
  const books = [
    book("One", ["James S. A. Corey"]),
    book("Two", ["James S. A. Corey"]),
  ]
  const result = buildAuthorCollections(books)
  assert.deepEqual(
    result.map((c) => c.name),
    ["James S. A. Corey"],
  )
})

test("series count merges spellings and number suffixes", () => {
  const books = [
    book("One", ["X"], [{ name: "The Expanse", position: 1 }]),
    book("Two", ["X"], [{ name: "Expanse 02", position: 2 }]),
    book("Three", ["X"], [{ name: "Other Saga", position: 1 }]),
    book("Four", ["X"]),
  ]
  const collection = buildAuthorCollections(books)[0]
  assert.equal(collection?.seriesCount, 2)
  assert.equal(
    authorCollectionLabel(collection as NonNullable<typeof collection>),
    "4 books, 2 series",
  )
})

test("label has no series part when there are none", () => {
  assert.equal(
    authorCollectionLabel({ books: [1, 2], seriesCount: 0 }),
    "2 books",
  )
})

test("detail splits series piles and loose books", () => {
  const books = [
    book("One", ["X"], [{ name: "Saga", position: 1 }]),
    book("Two", ["X"], [{ name: "Saga", position: 2 }]),
    book("Loose", ["X"]),
    book("Someone else", ["Y"]),
  ]
  const detail = authorCollectionDetail(books, "x")
  assert.ok(detail)
  assert.equal(detail.series.length, 1)
  assert.equal(detail.series[0]?.count, 2)
  assert.deepEqual(
    detail.looseBooks.map((b) => b.title),
    ["Loose"],
  )
  assert.equal(authorCollectionDetail(books, "y"), null)
  assert.equal(authorCollectionDetail(books, "nobody"), null)
})

test("covers are the newest three books", () => {
  const books = [
    book("Old", ["X"], [], "2020-01-01T00:00:00Z"),
    book("Newest", ["X"], [], "2024-03-01T00:00:00Z"),
    book("Mid", ["X"], [], "2022-01-01T00:00:00Z"),
    book("Newer", ["X"], [], "2024-01-01T00:00:00Z"),
  ]
  const collection = buildAuthorCollections(books)[0]
  assert.deepEqual(
    collection?.covers.map((b) => b.title),
    ["Newest", "Newer", "Mid"],
  )
})
