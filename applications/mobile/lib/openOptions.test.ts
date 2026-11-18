import assert from "node:assert/strict"

import { test } from "vitest"

import { autoplayParam, isAutoplayParam, shouldAutoplay } from "./openOptions"

test("only formats with audio autoplay", () => {
  assert.equal(shouldAutoplay("audiobook"), true)
  assert.equal(shouldAutoplay("readaloud"), true)
  assert.equal(shouldAutoplay("ebook"), false)
  assert.equal(shouldAutoplay(null), false)
})

test("the route param is only set when asked for and the format has audio", () => {
  assert.equal(autoplayParam("audiobook", { autoplay: true }), "1")
  assert.equal(autoplayParam("readaloud", { autoplay: true }), "1")
  assert.equal(autoplayParam("ebook", { autoplay: true }), undefined)
  assert.equal(autoplayParam("audiobook"), undefined)
  assert.equal(autoplayParam("audiobook", { autoplay: false }), undefined)
})

test("only the value 1 counts as autoplay", () => {
  assert.equal(isAutoplayParam("1"), true)
  assert.equal(isAutoplayParam(undefined), false)
  assert.equal(isAutoplayParam("0"), false)
  assert.equal(isAutoplayParam(["1"]), false)
})
