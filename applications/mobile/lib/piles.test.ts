import assert from "node:assert/strict"

import { test } from "vitest"

import {
  type PileBook,
  buildMissing,
  buildPiles,
  keepRealSeries,
} from "./piles"

interface Opts {
  title?: string
  createdAt?: string
  serverUuid?: string | null
  authors?: PileBook["authors"]
  pos?: number | null
  series?: string
}

function book(uuid: string, opts: Opts = {}): PileBook {
  return {
    uuid,
    title: opts.title ?? uuid,
    createdAt: opts.createdAt ?? "2024-01-01T00:00:00Z",
    serverUuid: opts.serverUuid ?? "srv1",
    authors: opts.authors ?? [{ uuid: "a1", name: "Ann" }],
    series: opts.series
      ? [
          {
            uuid: `s-${opts.series}`,
            name: opts.series,
            position: opts.pos ?? null,
          },
        ]
      : [],
  }
}

test("series piles use the first three books by position", () => {
  const books = [
    book("b4", { series: "X", pos: 4 }),
    book("b1", { series: "X", pos: 1 }),
    book("b3", { series: "X", pos: 3 }),
    book("b2", { series: "X", pos: 2 }),
    book("loose", { series: "X", pos: null }),
  ]
  const [pile] = buildPiles(books)
  assert.equal(pile?.count, 5)
  assert.equal(pile?.missing, 0)
  assert.deepEqual(
    pile?.books.map((b) => b.uuid),
    ["b1", "b2", "b3", "b4", "loose"],
  )
})

test("books without a series make no series pile", () => {
  assert.deepEqual(buildPiles([book("a")]), [])
})

test("the same series on two servers is one pile, ids kept apart", () => {
  const books = [
    book("a1", { series: "X", pos: 1, serverUuid: "one" }),
    book("a2", { series: "X", pos: 2, serverUuid: "one" }),
    {
      ...book("b3", { series: "X", pos: 3, serverUuid: "two" }),
      series: [{ uuid: "other-id", name: "x", position: 3 }],
    },
  ]
  const piles = buildPiles(books)
  assert.equal(piles.length, 1)
  assert.equal(piles[0]?.count, 3)
  assert.equal(piles[0]?.uuid, "s-X")
  assert.deepEqual(
    piles[0]?.books.map((b) => b.uuid),
    ["a1", "a2", "b3"],
  )
})

test("piles show how many are missing, and missing books list the gaps", () => {
  const books = [
    book("b1", { series: "X", pos: 1 }),
    book("b4", { series: "X", pos: 4 }),
    book("c1", { series: "Y", pos: 1 }),
  ]
  const piles = buildPiles(books)
  assert.equal(piles.find((p) => p.name === "X")?.missing, 2)
  assert.equal(piles.find((p) => p.name === "Y")?.missing, 0)
  const missing = buildMissing(books)
  assert.equal(missing.length, 1)
  assert.deepEqual(missing[0]?.missing, [2, 3])
})

test("spellings of one series merge, with positions unioned", () => {
  const mk = (
    uuid: string,
    author: [string, string],
    series: [string, string, number],
  ): PileBook => ({
    ...book(uuid),
    authors: [{ uuid: author[0], name: author[1] }],
    series: [{ uuid: series[0], name: series[1], position: series[2] }],
  })
  const books = [
    mk("b1", ["u1", "James S.A. Corey"], ["s1", "The Expanse", 1]),
    mk("b2", ["u1", "James S.A. Corey"], ["s1", "The Expanse", 2]),
    mk("b3", ["u2", "James S. A. Corey"], ["s2", "Expanse Series", 3]),
    mk("b5", ["u1", "James S.A. Corey"], ["s2", "Expanse Series", 5]),
  ]
  const piles = buildPiles(books)
  assert.equal(piles.length, 1)
  assert.equal(piles[0]?.uuid, "s1")
  assert.equal(piles[0]?.count, 4)
  assert.equal(piles[0]?.missing, 1)
  const missing = buildMissing(books)
  assert.equal(missing.length, 1)
  assert.deepEqual(missing[0]?.missing, [4])
})

test("a series is kept with two books, or when a numbered book shows others exist, not alone", () => {
  const books = [
    book("a1", { series: "Pair", pos: 1 }),
    book("a2", { series: "Pair", pos: 2 }),
    book("b3", { series: "Gap", pos: 3 }),
    book("c1", { series: "Alone", pos: 1 }),
    book("d", { series: "NoNumber" }),
  ]
  const names = keepRealSeries(buildPiles(books)).map((p) => p.name)
  assert.deepEqual(names.sort(), ["Gap", "Pair"])
})
