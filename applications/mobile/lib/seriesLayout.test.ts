import assert from "node:assert/strict"

import { test } from "vitest"

import { layoutSeries } from "./seriesLayout"

const make = (title: string, position: number | null) => ({ title, position })
const describeItems = (books: ReturnType<typeof make>[]) =>
  layoutSeries(books, (b) => b.position).map((i) =>
    i.type === "book" ? i.book.title : `gap${i.position}`,
  )

test("puts a gap tile where a whole number is missing", () => {
  assert.deepEqual(describeItems([make("c", 4), make("a", 1), make("b", 2)]), [
    "a",
    "b",
    "gap3",
    "c",
  ])
})

test("a series without gaps has no gap tiles", () => {
  assert.deepEqual(describeItems([make("b", 2), make("a", 1)]), ["a", "b"])
  assert.deepEqual(describeItems([make("only", 3)]), ["only"])
})

test("fractions sit in order and books without a position go last", () => {
  assert.deepEqual(
    describeItems([
      make("x", null),
      make("c", 3),
      make("half", 1.5),
      make("a", 1),
    ]),
    ["a", "half", "gap2", "c", "x"],
  )
})
