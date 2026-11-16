import assert from "node:assert/strict"

import { test } from "vitest"

import {
  TILT_LEVELS,
  TILT_STRENGTH,
  heroTiltStyle,
  tiltFor,
  tiltStyle,
} from "./tilt"

const ids = Array.from({ length: 200 }, (_, i) => `book-${i}-uuid`)

test("the strength of each level", () => {
  assert.equal(TILT_STRENGTH.off.maxDegrees, 0)
  assert.equal(TILT_STRENGTH.subtle.maxDegrees, 1.6)
  assert.equal(TILT_STRENGTH.medium.maxDegrees, 3)
  assert.equal(TILT_STRENGTH.strong.maxDegrees, 5)
  assert.equal(TILT_STRENGTH.off.maxOffset, 0)
  assert.equal(TILT_STRENGTH.subtle.maxOffset, 1.5)
  assert.equal(TILT_STRENGTH.medium.maxOffset, 2.5)
  assert.equal(TILT_STRENGTH.strong.maxOffset, 4)
})

test("the same id always leans the same way", () => {
  for (const level of TILT_LEVELS) {
    for (const id of ids) {
      assert.deepEqual(tiltFor(id, level), tiltFor(id, level))
    }
  }
})

test("the lean stays within the limits of every level", () => {
  for (const level of TILT_LEVELS) {
    const { maxDegrees, maxOffset } = TILT_STRENGTH[level]
    for (const id of ids) {
      const { rotateDeg, translateY } = tiltFor(id, level)
      assert.ok(Math.abs(rotateDeg) <= maxDegrees)
      assert.ok(Math.abs(translateY) <= maxOffset)
    }
  }
})

test("different ids do not all lean the same way", () => {
  for (const level of ["subtle", "medium", "strong"] as const) {
    const angles = new Set(ids.map((id) => tiltFor(id, level).rotateDeg))
    assert.ok(angles.size > 20)
    assert.ok(ids.some((id) => tiltFor(id, level).rotateDeg > 0))
    assert.ok(ids.some((id) => tiltFor(id, level).rotateDeg < 0))
  }
})

test("off and straight covers have no transform", () => {
  assert.equal(tiltStyle("anything", "off"), undefined)
  assert.equal(tiltStyle("anything", "strong", true), undefined)
  assert.ok(tiltStyle("anything", "subtle")?.transform)
  assert.equal(heroTiltStyle("off"), undefined)
  assert.ok(heroTiltStyle("subtle")?.transform)
})
