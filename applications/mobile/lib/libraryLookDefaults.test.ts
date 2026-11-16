import assert from "node:assert/strict"

import { test } from "vitest"

import {
  DEFAULT_LIBRARY_LOOK,
  normalizeLibraryLook,
} from "./libraryLookDefaults"

test("the defaults", () => {
  assert.deepEqual(DEFAULT_LIBRARY_LOOK, {
    tilt: "subtle",
    showTitles: false,
    blurFill: true,
    showCurrentlyReading: true,
  })
})

test("nothing stored gives the defaults", () => {
  assert.deepEqual(normalizeLibraryLook(undefined), DEFAULT_LIBRARY_LOOK)
  assert.deepEqual(normalizeLibraryLook(null), DEFAULT_LIBRARY_LOOK)
  assert.deepEqual(normalizeLibraryLook("junk"), DEFAULT_LIBRARY_LOOK)
})

test("stored choices are kept and bad ones fall back", () => {
  assert.deepEqual(
    normalizeLibraryLook({ tilt: "strong", showTitles: true, blurFill: 3 }),
    {
      ...DEFAULT_LIBRARY_LOOK,
      tilt: "strong",
      showTitles: true,
    },
  )
  assert.equal(normalizeLibraryLook({ tilt: "wild" }).tilt, "subtle")
})
