import assert from "node:assert"

import { describe, it } from "vitest"

import { buildGridSlots } from "@/gridSlots"

function book(
  title: string,
  opts: { series?: [string, number | null][] } = {},
) {
  return {
    uuid: title,
    title,
    series: (opts.series ?? []).map(([uuid, position]) => ({
      uuid,
      name: uuid,
      position,
    })),
  }
}

describe("buildGridSlots", () => {
  const owned = (n: number) => book(`b${n}`, { series: [["s", n]] })
  const describeSlots = (slots: ReturnType<typeof buildGridSlots>) =>
    slots.map((s) => (s.type === "gap" ? `#${s.position}?` : `#${s.bookIndex}`))

  it("puts a placeholder in the empty slot", () => {
    const slots = buildGridSlots([owned(1), owned(2), owned(4)], "s", [3])
    assert.deepStrictEqual(describeSlots(slots), ["#0", "#1", "#3?", "#2"])
  })

  it("handles several gaps in a row", () => {
    const slots = buildGridSlots([owned(1), owned(5)], "s", [2, 3, 4])
    assert.deepStrictEqual(describeSlots(slots), [
      "#0",
      "#2?",
      "#3?",
      "#4?",
      "#1",
    ])
  })

  it("keeps a series with no gaps unchanged", () => {
    const slots = buildGridSlots([owned(1), owned(2)], "s", [])
    assert.deepStrictEqual(describeSlots(slots), ["#0", "#1"])
  })

  it("waits for later pages before placing trailing gaps", () => {
    const books = [owned(1), owned(2)]
    assert.deepStrictEqual(
      describeSlots(buildGridSlots(books, "s", [3], true)),
      ["#0", "#1"],
    )
    assert.deepStrictEqual(
      describeSlots(buildGridSlots(books, "s", [3], false)),
      ["#0", "#1", "#3?"],
    )
  })
})
