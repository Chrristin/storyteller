import assert from "node:assert"

import { describe, it } from "vitest"

import { showKindleButton } from "@/kindle"

const withEbook = {
  ebook: { id: 1, filepath: "/books/a.epub", fileSize: 1000 },
} as never
const noEbook = { ebook: null } as never

describe("showKindleButton", () => {
  it("shows when Kindle is available and the book has an ebook", () => {
    assert.strictEqual(showKindleButton(withEbook, true), true)
  })

  it("hides when the user cannot send to a Kindle", () => {
    assert.strictEqual(showKindleButton(withEbook, false), false)
  })

  it("hides when the book has no ebook", () => {
    assert.strictEqual(showKindleButton(noEbook, true), false)
  })
})
