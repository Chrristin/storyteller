import { describe, expect, it } from "vitest"

import { sortArchiveBooks } from "./archiveOrder"

function book(
  title: string,
  author?: string,
  series?: [string, number | null],
) {
  return {
    title,
    authors: author ? [{ name: author }] : [],
    series: series ? [{ name: series[0], position: series[1] }] : [],
  }
}

describe("sortArchiveBooks", () => {
  it("orders by author, keeping spelling variants together", () => {
    const result = sortArchiveBooks([
      book("Z", "Terry Pratchett"),
      book("A", "Brandon Sanderson"),
      book("M", "terry  PRATCHETT"),
      book("Q", "Zed Author"),
      book("N", "Terry Pratchett's"),
    ])
    expect(result.map((b) => b.title)).toEqual(["A", "M", "Z", "N", "Q"])
  })

  it("orders series by name and position inside an author, then title", () => {
    const result = sortArchiveBooks([
      book("Loose", "Ann"),
      book("Two", "Ann", ["Saga", 2]),
      book("Other", "Ann", ["Alpha", 1]),
      book("One", "Ann", ["The Saga Series", 1]),
      book("Apple", "Ann"),
    ])
    expect(result.map((b) => b.title)).toEqual([
      "Other",
      "One",
      "Two",
      "Apple",
      "Loose",
    ])
  })

  it("puts books without an author last", () => {
    const result = sortArchiveBooks([book("Nobody"), book("Zed", "Zed Author")])
    expect(result.map((b) => b.title)).toEqual(["Zed", "Nobody"])
  })
})
