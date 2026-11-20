import assert from "node:assert/strict"

import { test } from "vitest"

import { findSeriesGaps, gapsInPositions } from "./seriesGaps"

function series(positions: (number | null)[], name = "S", uuid = "s1") {
  return {
    uuid,
    name,
    books: positions.map((position, i) => ({ uuid: `b${i}`, position })),
  }
}

test("finds the numbers between owned books", () => {
  const [gap] = findSeriesGaps([series([1, 2, 4, 7])])
  assert.deepEqual(gap?.missing, [3, 5, 6])
  assert.deepEqual(gap?.owned, [1, 2, 4, 7])
  assert.equal(gap?.upTo, 7)
})

test("never guesses beyond the highest owned book", () => {
  assert.deepEqual(findSeriesGaps([series([1, 2, 3])]), [])
  assert.equal(findSeriesGaps([series([3, 4])]).length, 0)
})

test("a series starting at 3 is judged only from 3 up", () => {
  assert.deepEqual(findSeriesGaps([series([3, 5])])[0]?.missing, [4])
})

test("ignores null, zero, negative and fractional positions", () => {
  assert.deepEqual(findSeriesGaps([series([null, 0, -1, 2.5, 1.5])]), [])
  assert.deepEqual(
    findSeriesGaps([series([1, 2.5, 3, null, 0])])[0]?.missing,
    [2],
  )
})

test("books at the same position count once", () => {
  assert.deepEqual(findSeriesGaps([series([1, 1, 1])]), [])
  assert.deepEqual(findSeriesGaps([series([1, 1, 3, 3])])[0]?.missing, [2])
})

test("needs two distinct whole positions", () => {
  assert.equal(gapsInPositions([5]), null)
  assert.equal(gapsInPositions([]), null)
  assert.equal(gapsInPositions([4, 4]), null)
})

test("sorts by number missing, then name", () => {
  const result = findSeriesGaps([
    series([1, 5], "Zed", "z"),
    series([1, 3], "Beta", "b"),
    series([1, 3], "Alpha", "a"),
  ])
  assert.deepEqual(
    result.map((r) => r.name),
    ["Alpha", "Beta", "Zed"],
  )
})
