import { describe, expect, it } from "vitest"

import { cleanTitle } from "@/titleCleanup"

const clean = (title: string, context = {}) => cleanTitle(title, context).title

describe("cleanTitle: noise suffixes", () => {
  it("strips bracketed noise words", () => {
    expect(clean("Dune (Unabridged)")).toBe("Dune")
    expect(clean("Originals (Unabridged)")).toBe("Originals")
    expect(clean("Dune [Audiobook]")).toBe("Dune")
    expect(clean("Dune (Abridged)")).toBe("Dune")
    expect(clean("Dune (Unabridged Audiobook)")).toBe("Dune")
    expect(clean("Dune (unabridged)")).toBe("Dune")
  })

  it("strips dashed noise at the end", () => {
    expect(clean("Dune - Unabridged")).toBe("Dune")
    expect(clean("Dune: Audiobook")).toBe("Dune")
  })

  it("keeps other brackets and noise words inside a title", () => {
    expect(clean("Dune (Wheel of Time, #1)")).toBe("Dune (Wheel of Time, #1)")
    expect(clean("The Unabridged Journey")).toBe("The Unabridged Journey")
    expect(clean("Audiobook Basics")).toBe("Audiobook Basics")
    expect(clean("Dune (Dramatized Adaptation)")).toBe(
      "Dune (Dramatized Adaptation)",
    )
  })
})

describe("cleanTitle: leading numbers", () => {
  it("strips a zero padded number", () => {
    expect(clean("01 Eye of the World")).toBe("Eye of the World")
    expect(clean("02. The Great Hunt")).toBe("The Great Hunt")
    expect(clean("03 - Dragon Reborn")).toBe("Dragon Reborn")
    expect(clean("014 Something")).toBe("Something")
  })

  it("strips a number equal to the series position", () => {
    expect(clean("14 A Memory of Light", { seriesPositions: [14] })).toBe(
      "A Memory of Light",
    )
    expect(clean("14 A Memory of Light")).toBe("14 A Memory of Light")
    expect(clean("14 A Memory of Light", { seriesPositions: [13] })).toBe(
      "14 A Memory of Light",
    )
  })

  it("never strips other numbers", () => {
    expect(clean("1984")).toBe("1984")
    expect(clean("7 Habits of Highly Effective People")).toBe(
      "7 Habits of Highly Effective People",
    )
    expect(clean("10 Rules for Life")).toBe("10 Rules for Life")
    expect(clean("2001: A Space Odyssey")).toBe("2001: A Space Odyssey")
    expect(clean("007 Goldfinger")).toBe("007 Goldfinger")
    expect(clean("1.5 Degrees")).toBe("1.5 Degrees")
    expect(clean("01")).toBe("01")
  })
})

describe("cleanTitle: leading article", () => {
  it("restores the article from a known title", () => {
    const knownTitles = ["The Eye of the World"]
    expect(clean("01 Eye of the World", { knownTitles })).toBe(
      "The Eye of the World",
    )
    expect(clean("Eye of the World", { knownTitles })).toBe(
      "The Eye of the World",
    )
    expect(
      clean("03 Dragon Reborn", { knownTitles: ["The Dragon Reborn"] }),
    ).toBe("The Dragon Reborn")
    expect(
      clean("Hobbit", { knownTitles: ["An Unrelated Hobbit", "The Hobbit"] }),
    ).toBe("The Hobbit")
  })

  it("never swaps in a different title", () => {
    expect(clean("Dune", { knownTitles: ["The Dune Encyclopedia"] })).toBe(
      "Dune",
    )
    expect(
      clean("Eye of the World", {
        knownTitles: ["The Eye of the World (Wheel of Time, #1)"],
      }),
    ).toBe("Eye of the World")
    // Without an article in the known title nothing is restored either.
    expect(clean("Dune", { knownTitles: ["DUNE"] })).toBe("Dune")
  })
})

describe("cleanTitle: general", () => {
  it("trims double spaces", () => {
    expect(clean("Dune   Messiah ")).toBe("Dune Messiah")
  })

  it("returns unchanged when nothing applies", () => {
    const result = cleanTitle("The Hobbit")
    expect(result).toEqual({ title: "The Hobbit", changes: [] })
  })

  it("explains what changed", () => {
    const result = cleanTitle("01 Eye of the World (Unabridged)", {
      knownTitles: ["The Eye of the World"],
    })
    expect(result.title).toBe("The Eye of the World")
    expect(result.changes).toEqual([
      'Removed "(Unabridged)"',
      'Removed track number "01"',
      'Restored "The" from the known title',
    ])
  })

  it("is idempotent", () => {
    const cases: [string, object][] = [
      [
        "01 Eye of the World (Unabridged)",
        { knownTitles: ["The Eye of the World"] },
      ],
      ["01 01 Foo", {}],
      ["Dune (Unabridged) (Audiobook)", {}],
      ["14 A Memory of Light", { seriesPositions: [14] }],
      ["Percy Jackson and the Olympians: the lightning thief", {}],
      ["  Spaced   out ", {}],
      ["1984", {}],
    ]
    for (const [title, context] of cases) {
      const once = cleanTitle(title, context).title
      expect(cleanTitle(once, context).title).toBe(once)
      expect(cleanTitle(once, context).changes).toEqual([])
    }
  })

  it("never returns an empty title", () => {
    expect(clean("(Unabridged)")).toBe("(Unabridged)")
  })
})
