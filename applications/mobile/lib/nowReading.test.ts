import { describe, expect, it } from "vitest"

import {
  MAX_NOW_READING_CIRCLES,
  circleBooks,
  sortInProgress,
} from "./nowReading"

const book = (uuid: string, timestamp?: number) => ({
  uuid,
  position: timestamp === undefined ? null : { timestamp },
})

describe("sortInProgress", () => {
  it("puts the book read last first, and books without a position last", () => {
    const sorted = sortInProgress([book("a", 1), book("b"), book("c", 9)])
    expect(sorted.map((b) => b.uuid)).toEqual(["c", "a", "b"])
  })
  it("does not change the input", () => {
    const input = [book("a", 1), book("b", 2)]
    sortInProgress(input)
    expect(input.map((b) => b.uuid)).toEqual(["a", "b"])
  })
})

describe("circleBooks", () => {
  it("is empty with one book or none, so the row is hidden", () => {
    expect(circleBooks([])).toEqual([])
    expect(circleBooks([book("a")])).toEqual([])
  })
  it("skips the book on the card", () => {
    expect(
      circleBooks([book("a"), book("b"), book("c")]).map((b) => b.uuid),
    ).toEqual(["b", "c"])
  })
  it("caps the number of circles", () => {
    const many = Array.from({ length: 12 }, (_, i) => book(`b${i}`))
    expect(circleBooks(many)).toHaveLength(MAX_NOW_READING_CIRCLES)
    expect(circleBooks(many, 2).map((b) => b.uuid)).toEqual(["b1", "b2"])
  })
})
