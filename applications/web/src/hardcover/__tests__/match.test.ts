import { describe, expect, it } from "vitest"

import { matchBook } from "../match"

import * as f from "./fixtures"

describe("matchBook", () => {
  it("is sure about the right book, even behind a junk edition", () => {
    const result = matchBook(
      { title: "The Two Towers", authors: ["J. R. R. Tolkien"] },
      [f.twoTowersJunkEdition, f.fellowship, f.twoTowers],
    )
    expect(result.confidence).toBe("sure")
    expect(result.suggestion?.hardcoverId).toBe("1")
    expect(result.suggestion?.series).toEqual({
      name: "The Lord of the Rings",
      position: 2,
    })
    expect(result.suggestion?.genres).toEqual([
      "Fantasy",
      "Classics",
      "Science Fiction",
    ])
    expect(result.suggestion?.moods).toEqual([
      "adventurous",
      "tense",
      "hopeful",
    ])
  })

  it("does not take a neighbour listed as an alternative title as sure", () => {
    const result = matchBook(
      { title: "The Two Towers", authors: ["J.R.R. Tolkien"] },
      [f.fellowship],
    )
    expect(result.confidence).toBe("check")
    expect(result.suggestion?.matchedTitle).toBe("The Fellowship of the Ring")
  })

  it("finds nothing when only summaries exist", () => {
    const result = matchBook(
      { title: "The Midnight Library", authors: ["Matt Haig"] },
      [f.midnightSummary, f.midnightSuperSummary],
    )
    expect(result.confidence).toBe("none")
    expect(result.suggestion).toBeNull()
  })

  it("skips a study guide at the top", () => {
    const result = matchBook(
      { title: "Caliban's War", authors: ["James S. A. Corey"] },
      [f.calibanStudyGuide, f.boxSet, f.calibanReal],
    )
    expect(result.confidence).toBe("sure")
    expect(result.suggestion?.matchedTitle).toBe("Caliban's War")
    expect(result.suggestion?.series.name).toBe("The Expanse")
    expect(result.suggestion?.series.position).toBe(2)
  })

  it("accepts a study guide when the library book is one", () => {
    const result = matchBook(
      { title: "Caliban's War: A Study Guide", authors: ["SuperSummary"] },
      [f.calibanStudyGuide],
    )
    expect(result.confidence).not.toBe("none")
  })

  it("prefers the novel over a comic adaptation", () => {
    const result = matchBook(
      { title: "The Eye of the World", authors: ["Robert Jordan"] },
      [f.eyeComic, f.eyeReal],
    )
    expect(result.confidence).toBe("sure")
    expect(result.suggestion?.matchedTitle).toBe("The Eye of the World")
    expect(result.suggestion?.genres).toEqual(["Fantasy"])
  })

  it("never calls a lone comic sure", () => {
    const result = matchBook(
      { title: "Eye of the World", authors: ["Robert Jordan"] },
      [f.eyeComic],
    )
    expect(result.confidence).toBe("check")
    expect(result.reasons.join(" ")).toMatch(/comic/i)
  })

  it("asks to check when the series is right but the book is not", () => {
    const result = matchBook({ title: "Dune", authors: ["Frank Herbert"] }, [
      f.godEmperor,
    ])
    expect(result.confidence).toBe("check")
    expect(result.suggestion?.matchedTitle).toBe("God Emperor of Dune")
  })

  it("requires an author overlap", () => {
    const result = matchBook(
      { title: "The Two Towers", authors: ["Somebody Else"] },
      [f.twoTowers],
    )
    expect(result.confidence).toBe("none")
  })

  it("is only unsure when the book has no author", () => {
    const result = matchBook({ title: "The Two Towers", authors: [] }, [
      f.twoTowers,
    ])
    expect(result.confidence).toBe("check")
  })

  it("rejects box sets and compilations unless the library book is one", () => {
    const plain = matchBook(
      { title: "The Expanse", authors: ["James S.A. Corey"] },
      [f.boxSet],
    )
    expect(plain.confidence).toBe("none")
    const box = matchBook(
      { title: "The Expanse Box Set Books 1-3", authors: ["James S.A. Corey"] },
      [f.boxSet],
    )
    expect(box.confidence).toBe("sure")
  })

  it("handles an audio drama against the novel", () => {
    // Library has the drama, Hardcover also has it: sure.
    const same = matchBook(
      {
        title: "Neverwhere (Full Cast Dramatisation)",
        authors: ["Neil Gaiman"],
      },
      [f.neverwhereDrama],
    )
    expect(same.confidence).toBe("sure")
    // Library has the drama, only the novel is found: a different edition.
    const novelOnly = matchBook(
      {
        title: "Neverwhere (Full Cast Dramatisation)",
        authors: ["Neil Gaiman"],
      },
      [f.neverwhereNovel],
    )
    expect(novelOnly.confidence).toBe("check")
    // Library has the novel, the drama is not taken over the novel.
    const novel = matchBook({ title: "Neverwhere", authors: ["Neil Gaiman"] }, [
      f.neverwhereDrama,
      f.neverwhereNovel,
    ])
    expect(novel.confidence).toBe("sure")
    expect(novel.suggestion?.matchedTitle).toBe("Neverwhere")
  })

  it("matches loosely written authors only as check", () => {
    const result = matchBook(
      { title: "Caliban's War", authors: ["James Corey"] },
      [f.calibanReal],
    )
    expect(result.confidence).toBe("check")
  })

  it("ignores a subtitle and series brackets in the library title", () => {
    const result = matchBook(
      {
        title:
          "The Eye of the World: Book One of The Wheel of Time (Wheel of Time #1)",
        authors: ["Robert Jordan"],
      },
      [f.eyeReal],
    )
    expect(result.confidence).toBe("sure")
  })

  it("uses an existing series name to choose between names", () => {
    const result = matchBook(
      { title: "Caliban's War", authors: ["James S. A. Corey"] },
      [{ ...f.calibanReal, featured_series: null }],
    )
    expect(result.suggestion?.series).toEqual({
      name: "The Expanse",
      position: null,
    })
  })
})
