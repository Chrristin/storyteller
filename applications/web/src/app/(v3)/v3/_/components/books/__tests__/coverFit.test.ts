import { describe, expect, it } from "vitest"

import { COVER_ASPECT } from "../Grid/bookCardSizing"
import { DEFAULT_SLOT_ASPECT, coverBoxAspect } from "../coverFit"

describe("tall card shape", () => {
  it("is 2:3 and the row height maths agrees", () => {
    expect(DEFAULT_SLOT_ASPECT).toBeCloseTo(2 / 3)
    expect(COVER_ASPECT).toBeCloseTo(3 / 2)
    expect(COVER_ASPECT * DEFAULT_SLOT_ASPECT).toBeCloseTo(1)
  })

  it("lets a nominal ebook cover fill the card exactly", () => {
    expect(coverBoxAspect("cover", "ebook", null)).toBeCloseTo(
      DEFAULT_SLOT_ASPECT,
    )
  })
})
