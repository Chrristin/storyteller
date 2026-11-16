import { describe, expect, it } from "vitest"

import {
  coverLabel,
  metaHeightFor,
  showMetaUnderCard,
} from "../Grid/bookCardSizing"

describe("showMetaUnderCard", () => {
  it("is off unless the preference is on", () => {
    expect(showMetaUnderCard(false, ["authors", "title"])).toBe(false)
    expect(showMetaUnderCard(true, ["authors", "title"])).toBe(true)
  })

  it("is off when there is nothing to show", () => {
    expect(showMetaUnderCard(true, [])).toBe(false)
  })
})

describe("metaHeightFor", () => {
  it("is 0 when titles are not under covers", () => {
    expect(metaHeightFor(["authors", "title"], "medium", false)).toBe(0)
  })

  it("keeps the old height when titles are under covers", () => {
    // mt-2 (8) + one title row (42) + one author row (20)
    expect(metaHeightFor(["authors", "title"], "medium", true)).toBe(70)
    expect(metaHeightFor(["authors", "title"], "smallest", true)).toBe(62)
  })

  it("is 0 with no fields even when the preference is on", () => {
    expect(metaHeightFor([], "medium", true)).toBe(0)
  })
})

describe("coverLabel", () => {
  it("joins title and authors", () => {
    expect(coverLabel("Dune", ["Frank Herbert"])).toBe("Dune by Frank Herbert")
    expect(coverLabel("Good Omens", ["A", "B"])).toBe("Good Omens by A, B")
  })

  it("falls back to the title alone", () => {
    expect(coverLabel("Dune", [])).toBe("Dune")
  })
})
