import { describe, expect, it } from "vitest"

import { cleanPosition, isWholePosition, pickPrimarySeries } from "../series"

describe("pickPrimarySeries", () => {
  it("uses the featured series and its position", () => {
    expect(
      pickPrimarySeries({
        seriesNames: ["The Lord of the Rings", "Middle Earth"],
        featuredSeries: {
          position: 2,
          series: { name: "The Lord of the Rings" },
        },
      }),
    ).toEqual({ name: "The Lord of the Rings", position: 2 })
  })

  it("drops chronological and universe lists without a featured series", () => {
    expect(
      pickPrimarySeries({
        seriesNames: [
          "Dune",
          "Dune Universe (Chronological)",
          "Dune Universe (Publication Order)",
        ],
      }),
    ).toEqual({ name: "Dune", position: null })
    expect(
      pickPrimarySeries({
        seriesNames: ["The Expanse", "The Expanse (Chronological)"],
      }).name,
    ).toBe("The Expanse")
  })

  it("does not trust a featured series that is a reading order list", () => {
    expect(
      pickPrimarySeries({
        seriesNames: ["Dune", "Dune Universe (Chronological)"],
        featuredSeries: {
          position: 6,
          series: { name: "Dune Universe (Chronological)" },
        },
      }),
    ).toEqual({ name: "Dune", position: null })
  })

  it("prefers a name the book already has, then the shortest", () => {
    const names = [
      "Novels of the Malazan Empire",
      "Malazan",
      "Malazan (In-World Chronological Order)",
    ]
    expect(pickPrimarySeries({ seriesNames: names }).name).toBe("Malazan")
    expect(
      pickPrimarySeries({
        seriesNames: names,
        existingSeries: ["Novels of the Malazan Empire 03"],
      }).name,
    ).toBe("Novels of the Malazan Empire")
  })

  it("returns no series when every name is excluded", () => {
    expect(
      pickPrimarySeries({ seriesNames: ["Dune Universe (Chronological)"] }),
    ).toEqual({ name: null, position: null })
    expect(pickPrimarySeries({ seriesNames: null })).toEqual({
      name: null,
      position: null,
    })
  })
})

describe("positions", () => {
  it("keeps whole and half positions only", () => {
    expect(cleanPosition(2)).toBe(2)
    expect(cleanPosition("3")).toBe(3)
    expect(cleanPosition(2.5)).toBe(2.5)
    expect(cleanPosition(2.3)).toBeNull()
    expect(cleanPosition(0)).toBeNull()
    expect(cleanPosition(-1)).toBeNull()
    expect(cleanPosition(null)).toBeNull()
  })

  it("applies only whole positive numbers", () => {
    expect(isWholePosition(2)).toBe(true)
    expect(isWholePosition(2.5)).toBe(false)
    expect(isWholePosition(null)).toBe(false)
    expect(isWholePosition(0)).toBe(false)
  })
})
