import assert from "node:assert/strict"

import { test } from "vitest"

import {
  OVERLAY_AUTHOR_LINES,
  OVERLAY_FONT_SIZES,
  OVERLAY_TITLE_LINES,
  shouldShowTitleOverlay,
} from "./coverTitleOverlay"

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

test("overlay text keeps one size and is cut off with an ellipsis", () => {
  assert.deepEqual(OVERLAY_FONT_SIZES, { title: 13, author: 11 })
  assert.equal(OVERLAY_TITLE_LINES, 2)
  assert.equal(OVERLAY_AUTHOR_LINES, 1)
})
