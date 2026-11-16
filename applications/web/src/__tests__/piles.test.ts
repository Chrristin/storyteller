import assert from "node:assert"

import { describe, it } from "vitest"

import {
  type PileBook,
  authorCovers,
  buildGridSlots,
  buildPiles,
  seriesCovers,
} from "@/piles"

function book(
  title: string,
  opts: {
    series?: [string, number | null][]
    author?: string
    createdAt?: string
  } = {},
): PileBook {
  return {
    uuid: title,
    title,
    createdAt: opts.createdAt ?? "2024-01-01T00:00:00Z",
    authors: opts.author ? [{ uuid: opts.author, name: opts.author }] : [],
    series: (opts.series ?? []).map(([uuid, position]) => ({
      uuid,
      name: uuid,
      position,
    })),
  }
}

describe("seriesCovers", () => {
  it("takes the first three by position, unpositioned last", () => {
    const books = [
      book("d", { series: [["s", null]] }),
      book("c", { series: [["s", 3]] }),
      book("a", { series: [["s", 1]] }),
      book("b", { series: [["s", 2]] }),
    ]
    assert.deepStrictEqual(
      seriesCovers(books, "s").map((b) => b.title),
      ["a", "b", "c"],
    )
  })
})

describe("authorCovers", () => {
  it("takes the three newest books", () => {
    const books = [
      book("old", { createdAt: "2020-01-01" }),
      book("new", { createdAt: "2024-01-01" }),
      book("mid", { createdAt: "2022-01-01" }),
      book("older", { createdAt: "2019-01-01" }),
    ]
    assert.deepStrictEqual(
      authorCovers(books).map((b) => b.title),
      ["new", "mid", "old"],
    )
  })
})

describe("buildPiles", () => {
  it("groups by series and attaches missing counts", () => {
    const books = [
      book("a", { series: [["s1", 1]] }),
      book("b", { series: [["s1", 3]] }),
      book("c", { series: [["s2", 1]] }),
      book("loose"),
    ]
    const piles = buildPiles(books, "series", new Map([["s1", 1]]))
    assert.deepStrictEqual(
      piles.map((p) => [p.name, p.count, p.missing]),
      [
        ["s1", 2, 1],
        ["s2", 1, 0],
      ],
    )
  })

  it("groups by first author only", () => {
    const first = book("a", { author: "x" })
    first.authors.push({ uuid: "y", name: "y" })
    const piles = buildPiles([first, book("b", { author: "x" })], "author")
    assert.deepStrictEqual(
      piles.map((p) => [p.name, p.count, p.missing]),
      [["x", 2, 0]],
    )
  })
})

describe("buildPiles with spellings", () => {
  it("merges author spellings into one pile linked to the biggest", () => {
    const mk = (title: string, uuid: string, name: string) => ({
      ...book(title),
      authors: [{ uuid, name }],
    })
    const piles = buildPiles(
      [
        mk("a", "u2", "James S. A. Corey"),
        mk("b", "u1", "James S.A. Corey"),
        mk("c", "u1", "James S.A. Corey"),
        mk("d", "u3", "Someone Else"),
      ],
      "author",
    )
    assert.deepStrictEqual(
      piles.map((p) => [p.name, p.uuid, p.count]),
      [
        ["James S.A. Corey", "u1", 3],
        ["Someone Else", "u3", 1],
      ],
    )
  })

  it("merges series spellings, counts a book once, uses the representative", () => {
    const inSeries = (
      title: string,
      refs: [string, string, number][],
    ): PileBook => ({
      ...book(title),
      series: refs.map(([uuid, name, position]) => ({ uuid, name, position })),
    })
    const books = [
      inSeries("a", [["s9", "Expanse", 1]]),
      inSeries("b", [["s9", "Expanse", 2]]),
      inSeries("c", [["s1", "The Expanse Series", 3]]),
      inSeries("d", [
        ["s1", "The Expanse Series", 5],
        ["s9", "Expanse", 5],
      ]),
    ]
    const piles = buildPiles(books, "series", new Map([["s9", 1]]))
    assert.strictEqual(piles.length, 1)
    assert.strictEqual(piles[0]?.uuid, "s9")
    assert.strictEqual(piles[0]?.name, "Expanse")
    assert.strictEqual(piles[0]?.count, 4)
    assert.strictEqual(piles[0]?.missing, 1)
    assert.deepStrictEqual(
      piles[0]?.covers.map((b) => b.title),
      ["a", "b", "c"],
    )
  })
})

describe("buildGridSlots", () => {
  const owned = (n: number) => book(`b${n}`, { series: [["s", n]] })
  const describeSlots = (slots: ReturnType<typeof buildGridSlots>) =>
    slots.map((s) => (s.type === "gap" ? `#${s.position}?` : `#${s.bookIndex}`))

  it("puts a placeholder in the empty slot", () => {
    const slots = buildGridSlots([owned(1), owned(2), owned(4)], "s", [3])
    assert.deepStrictEqual(describeSlots(slots), ["#0", "#1", "#3?", "#2"])
  })

  it("handles several gaps in a row", () => {
    const slots = buildGridSlots([owned(1), owned(5)], "s", [2, 3, 4])
    assert.deepStrictEqual(describeSlots(slots), [
      "#0",
      "#2?",
      "#3?",
      "#4?",
      "#1",
    ])
  })

  it("keeps a series with no gaps unchanged", () => {
    const slots = buildGridSlots([owned(1), owned(2)], "s", [])
    assert.deepStrictEqual(describeSlots(slots), ["#0", "#1"])
  })

  it("waits for later pages before placing trailing gaps", () => {
    const books = [owned(1), owned(2)]
    assert.deepStrictEqual(
      describeSlots(buildGridSlots(books, "s", [3], true)),
      ["#0", "#1"],
    )
    assert.deepStrictEqual(
      describeSlots(buildGridSlots(books, "s", [3], false)),
      ["#0", "#1", "#3?"],
    )
  })
})
