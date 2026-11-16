import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { normaliseAuthorName, normaliseSeriesName } from "./nameKey"

describe("name keys", () => {
  it("joins initials and ignores case and punctuation for authors", () => {
    const same = (a: string, b: string) =>
      assert.equal(normaliseAuthorName(a), normaliseAuthorName(b))
    same("James S.A. Corey", "James S. A. Corey")
    same("J.R.R. Tolkien", "J. R. R. Tolkien")
    same("Oyinkan Braithwaite", "oyinkan braithwaite")
  })

  it("ignores The and Series style suffixes for series", () => {
    const same = (a: string, b: string) =>
      assert.equal(normaliseSeriesName(a), normaliseSeriesName(b))
    same("The Stormlight Archive", "Stormlight Archive")
    same("Mistborn Saga", "Mistborn")
  })

  it("keeps different names different", () => {
    assert.notEqual(
      normaliseAuthorName("James Corey"),
      normaliseAuthorName("James S. A. Corey"),
    )
    assert.notEqual(
      normaliseSeriesName("Mistborn"),
      normaliseSeriesName("Mistborn Era Two"),
    )
  })
})
