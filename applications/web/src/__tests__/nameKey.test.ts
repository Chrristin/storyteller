import assert from "node:assert"

import { describe, it } from "vitest"

import {
  cleanSeriesDisplayName,
  normaliseAuthorName,
  normaliseSeriesName,
} from "@/nameKey"

describe("name keys", () => {
  it("joins initials and ignores case and punctuation for authors", () => {
    const same = (a: string, b: string) =>
      assert.strictEqual(normaliseAuthorName(a), normaliseAuthorName(b))
    same("James S.A. Corey", "James S. A. Corey")
    same("J.R.R. Tolkien", "J. R. R. Tolkien")
    same("Oyinkan Braithwaite", "oyinkan braithwaite")
  })

  it("ignores The and Series style suffixes for series", () => {
    const same = (a: string, b: string) =>
      assert.strictEqual(normaliseSeriesName(a), normaliseSeriesName(b))
    same("The Stormlight Archive", "Stormlight Archive")
    same("Mistborn Saga", "Mistborn")
  })

  it("keeps different names different", () => {
    assert.notStrictEqual(
      normaliseAuthorName("James Corey"),
      normaliseAuthorName("James S. A. Corey"),
    )
    assert.notStrictEqual(
      normaliseSeriesName("Mistborn"),
      normaliseSeriesName("Mistborn Era Two"),
    )
  })
})

describe("series numbers on the end", () => {
  it("treats Expanse 05 and The Expanse as one series", () => {
    assert.strictEqual(
      normaliseSeriesName("Expanse 05"),
      normaliseSeriesName("The Expanse"),
    )
    assert.strictEqual(
      normaliseSeriesName("Malazan Empire 01"),
      "malazan empire",
    )
    assert.strictEqual(normaliseSeriesName("Saga, Book 2"), "saga")
  })
  it("cleans the number off the display name", () => {
    assert.strictEqual(cleanSeriesDisplayName("Expanse 05"), "Expanse")
    assert.strictEqual(
      cleanSeriesDisplayName("Malazan Empire 01"),
      "Malazan Empire",
    )
    assert.strictEqual(cleanSeriesDisplayName("Dune"), "Dune")
  })
})
