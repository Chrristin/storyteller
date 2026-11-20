import assert from "node:assert"

import { describe, it } from "vitest"

import {
  COVER_PALETTE,
  buildCoverSvg,
  fnv1a,
  normalizeTitle,
  renderGeneratedCover,
  wrapTitle,
} from "../generatedCover"

describe("wrapTitle", () => {
  it("wraps by words at about twelve characters", () => {
    assert.deepStrictEqual(wrapTitle("Pride and Prejudice"), [
      "Pride and",
      "Prejudice",
    ])
  })

  it("breaks words that are longer than a line", () => {
    assert.deepStrictEqual(wrapTitle("Supercalifragilistic"), [
      "Supercalifra",
      "gilistic",
    ])
  })

  it("keeps at most five lines and ends with an ellipsis", () => {
    const lines = wrapTitle(
      "one two three four five six seven eight nine ten eleven twelve",
    )
    assert.strictEqual(lines.length, 5)
    assert.ok(lines[4]?.endsWith("…"))
    assert.ok(lines.every((line) => Array.from(line).length <= 12))
  })

  it("returns nothing for an empty title", () => {
    assert.deepStrictEqual(wrapTitle("   "), [])
  })
})

describe("buildCoverSvg", () => {
  it("is a pure function of title and author", () => {
    assert.strictEqual(
      buildCoverSvg("The Hobbit", "Tolkien"),
      buildCoverSvg("The Hobbit", "Tolkien"),
    )
  })

  it("normalises the title for the colour and the shapes", () => {
    assert.strictEqual(normalizeTitle("  The   HOBBIT "), "the hobbit")
    assert.strictEqual(
      fnv1a("the hobbit"),
      fnv1a(normalizeTitle(" The  Hobbit")),
    )
  })

  it("uses a palette colour and five shapes", () => {
    const svg = buildCoverSvg("Dune")
    assert.ok(COVER_PALETTE.some(([background]) => svg.includes(background)))
    const shapes = svg.match(/<(circle|rect|polygon) [^>]*fill-opacity/g) ?? []
    // five shapes plus the rule under the title
    assert.strictEqual(shapes.length, 6)
  })

  it("escapes markup in titles and authors", () => {
    const svg = buildCoverSvg("<b>&</b>", 'A "B"')
    assert.ok(!svg.includes("<b>"))
    assert.ok(svg.includes("&lt;b&gt;&amp;"))
  })

  it("uppercases the first author and survives a missing one", () => {
    assert.ok(buildCoverSvg("Dune", "frank herbert").includes("FRANK HERBERT"))
    assert.doesNotThrow(() => buildCoverSvg("Dune", null))
    assert.doesNotThrow(() => buildCoverSvg("Dune", ""))
  })

  it("does not throw on empty, huge, unicode and right to left titles", () => {
    for (const title of [
      "",
      "x".repeat(5000),
      "word ".repeat(500),
      "\u{1F4DA} 日本語のタイトル",
      "كتاب الأمير",
      "a\u0000b\u001fc",
    ]) {
      assert.ok(buildCoverSvg(title, title).startsWith("<svg"))
    }
  })
})

describe("renderGeneratedCover", () => {
  it("gives the same bytes for the same title and different ones otherwise", async () => {
    const a1 = await renderGeneratedCover("The Hobbit", "Tolkien")
    const a2 = await renderGeneratedCover("The Hobbit", "Tolkien")
    const b = await renderGeneratedCover("Dune", "Herbert")
    assert.ok(a1.data.equals(a2.data))
    assert.ok(!a1.data.equals(b.data))
  })

  it("is a 600 by 900 png", async () => {
    const { data, mimeType } = await renderGeneratedCover("Dune")
    assert.strictEqual(mimeType, "image/png")
    assert.deepStrictEqual([...data.subarray(1, 4)], [0x50, 0x4e, 0x47])
    assert.strictEqual(data.readUInt32BE(16), 600)
    assert.strictEqual(data.readUInt32BE(20), 900)
  })
})
