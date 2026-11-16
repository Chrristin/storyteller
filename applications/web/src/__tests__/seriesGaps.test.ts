import assert from "node:assert"

import { describe, it } from "vitest"

import {
  type GapSeriesInput,
  findSeriesGaps,
  mergeSeriesByName,
} from "@/seriesGaps"

function series(
  name: string,
  positions: (number | null)[],
  authors: string[] = ["A"],
): GapSeriesInput {
  return {
    uuid: `s-${name}`,
    name,
    authors,
    books: positions.map((position, i) => ({
      bookUuid: `${name}-${i}`,
      position,
    })),
  }
}

describe("findSeriesGaps", () => {
  it("reports whole numbers missing between lowest and highest owned", () => {
    const [gap] = findSeriesGaps([series("S", [1, 2, 5])])
    assert.deepStrictEqual(gap?.owned, [1, 2, 5])
    assert.deepStrictEqual(gap?.missing, [3, 4])
    assert.strictEqual(gap?.upTo, 5)
  })

  it("does not guess beyond the highest owned position", () => {
    assert.deepStrictEqual(findSeriesGaps([series("S", [1, 2, 3])]), [])
  })

  it("ignores null, zero and fractional positions", () => {
    const [gap] = findSeriesGaps([series("S", [null, 0, 1, 2.5, 3])])
    assert.deepStrictEqual(gap?.owned, [1, 3])
    assert.deepStrictEqual(gap?.missing, [2])
    assert.deepStrictEqual(findSeriesGaps([series("S", [1, 1.5, 2])]), [])
  })

  it("counts editions at the same position once", () => {
    assert.deepStrictEqual(findSeriesGaps([series("S", [1, 1, 2, 2])]), [])
    const [gap] = findSeriesGaps([series("S", [1, 1, 3])])
    assert.deepStrictEqual(gap?.owned, [1, 3])
  })

  it("needs two distinct whole positions", () => {
    assert.deepStrictEqual(findSeriesGaps([series("S", [4])]), [])
    assert.deepStrictEqual(findSeriesGaps([series("S", [4, 4])]), [])
    assert.deepStrictEqual(findSeriesGaps([series("S", [])]), [])
  })

  it("sorts by missing count descending, then name", () => {
    const result = findSeriesGaps([
      series("Beta", [1, 3]),
      series("Alpha", [1, 3]),
      series("Gamma", [1, 5]),
    ])
    assert.deepStrictEqual(
      result.map((g) => g.name),
      ["Gamma", "Alpha", "Beta"],
    )
  })

  it("passes uuid and authors through", () => {
    const [gap] = findSeriesGaps([series("S", [1, 3], ["X", "Y"])])
    assert.strictEqual(gap?.uuid, "s-S")
    assert.deepStrictEqual(gap?.authors, ["X", "Y"])
  })
})

describe("mergeSeriesByName", () => {
  it("merges two spellings so there is no false gap", () => {
    const a = { ...series("The Expanse", [1, 2], ["J"]), uuid: "b" }
    const b = { ...series("Expanse Series", [3, 5], ["K"]), uuid: "a" }
    const merged = mergeSeriesByName([a, b])
    assert.strictEqual(merged.length, 1)
    const gaps = findSeriesGaps(merged)
    assert.strictEqual(gaps.length, 1)
    assert.deepStrictEqual(gaps[0]?.missing, [4])
    assert.deepStrictEqual(gaps[0]?.authors, ["J", "K"])
    // Same number of books: the smallest uuid wins.
    assert.strictEqual(gaps[0]?.uuid, "a")
  })

  it("uses the series with the most books as the representative", () => {
    const a = { ...series("Foo", [1]), uuid: "a" }
    const b = { ...series("foo saga", [2, 4]), uuid: "z" }
    const [merged] = mergeSeriesByName([a, b])
    assert.strictEqual(merged?.uuid, "z")
    assert.strictEqual(merged?.name, "foo saga")
  })

  it("counts a book in both series once and keeps different names apart", () => {
    const a = series("Foo", [1, 2])
    const b = { ...series("Foo.", [1, 2]), uuid: "other" }
    b.books = a.books
    const merged = mergeSeriesByName([a, b, series("Bar", [1, 3])])
    assert.strictEqual(merged.length, 2)
    assert.strictEqual(merged[0]?.books.length, 2)
  })
})
