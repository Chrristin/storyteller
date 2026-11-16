import assert from "node:assert/strict"

import { test } from "vitest"

import { overlayFontSizes, shouldShowTitleOverlay } from "./coverTitleOverlay"

test("overlay shows only for list covers with waves and no titles under", () => {
  const on = { showTitleOverlay: true, waveFill: true, showTitles: false }
  assert.equal(shouldShowTitleOverlay(on), true)
  assert.equal(
    shouldShowTitleOverlay({ ...on, showTitleOverlay: false }),
    false,
  )
  assert.equal(shouldShowTitleOverlay({ ...on, waveFill: false }), false)
  assert.equal(shouldShowTitleOverlay({ ...on, showTitles: true }), false)
})

test("overlay font sizes shrink on narrow covers but stay readable", () => {
  assert.deepEqual(overlayFontSizes(200), { title: 13, author: 11 })
  const narrow = overlayFontSizes(110)
  assert.ok(narrow.title < 13 && narrow.title >= 10.4)
  assert.ok(narrow.author < 11 && narrow.author >= 8.8)
  assert.deepEqual(overlayFontSizes(40), { title: 10.4, author: 8.8 })
})
