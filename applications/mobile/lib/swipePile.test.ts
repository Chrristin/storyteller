import assert from "node:assert/strict"

import { test } from "vitest"

import {
  PILE_BOOK_CAP,
  capPileBooks,
  dotWindow,
  nextIndex,
  peekIndexes,
  previousIndex,
  stepIndex,
  followOffset,
  swipeDecision,
} from "./swipePile"

test("next and previous wrap around", () => {
  assert.equal(nextIndex(0, 3), 1)
  assert.equal(nextIndex(2, 3), 0)
  assert.equal(previousIndex(0, 3), 2)
  assert.equal(previousIndex(2, 3), 1)
  assert.equal(nextIndex(0, 0), 0)
  assert.equal(stepIndex(1, 4, -6), 3)
  assert.equal(stepIndex(1, 4, 6), 3)
})

test("a short flick past an eighth of the width is a swipe, left goes next", () => {
  assert.equal(swipeDecision(-30, 0, 100, 5), 1)
  assert.equal(swipeDecision(30, 0, 100, 5), -1)
  assert.equal(swipeDecision(-14, 0, 100, 5), 1)
  assert.equal(swipeDecision(-10, 0, 100, 5), 0)
  assert.equal(swipeDecision(10, 100, 100, 5), 0)
})

test("a fast fling swipes even a short drag, a flick back or twitch does not", () => {
  assert.equal(swipeDecision(-8, -900, 100, 5), 1)
  assert.equal(swipeDecision(8, 900, 100, 5), -1)
  assert.equal(swipeDecision(-4, -900, 100, 5), 0)
  assert.equal(swipeDecision(-8, 900, 100, 5), 0)
})

test("the front cover follows the finger a little and stops early", () => {
  assert.equal(followOffset(0, 100), 0)
  assert.equal(followOffset(-20, 100), -8)
  assert.equal(followOffset(20, 100), 8)
  assert.equal(followOffset(-300, 100), -25)
  assert.equal(followOffset(300, 100), 25)
})

test("one book or none never swipes", () => {
  assert.equal(swipeDecision(-90, -2000, 100, 1), 0)
  assert.equal(swipeDecision(-90, -2000, 100, 0), 0)
})

test("dots: one per book up to five", () => {
  assert.deepEqual(dotWindow(0, 2), { count: 2, active: 0 })
  assert.deepEqual(dotWindow(4, 5), { count: 5, active: 4 })
  assert.deepEqual(dotWindow(0, 0), { count: 0, active: 0 })
})

test("dots: five buckets beyond five books, first and last at the ends", () => {
  assert.deepEqual(dotWindow(0, 10), { count: 5, active: 0 })
  assert.deepEqual(dotWindow(1, 10), { count: 5, active: 0 })
  assert.deepEqual(dotWindow(2, 10), { count: 5, active: 1 })
  assert.deepEqual(dotWindow(9, 10), { count: 5, active: 4 })
  assert.deepEqual(dotWindow(29, 30), { count: 5, active: 4 })
  const actives = Array.from({ length: 7 }, (_, i) => dotWindow(i, 7).active)
  assert.deepEqual(actives, [0, 0, 1, 2, 2, 3, 4])
})

test("peek indexes wrap and never include the front book", () => {
  assert.deepEqual(peekIndexes(0, 5), [1, 2])
  assert.deepEqual(peekIndexes(4, 5), [0, 1])
  assert.deepEqual(peekIndexes(0, 2), [1])
  assert.deepEqual(peekIndexes(0, 1), [])
})

test("a pile carries at most 30 books", () => {
  const many = Array.from({ length: 45 }, (_, i) => i)
  assert.equal(PILE_BOOK_CAP, 30)
  assert.equal(capPileBooks(many).length, 30)
  assert.equal(capPileBooks(many)[0], 0)
  assert.equal(capPileBooks([1, 2]).length, 2)
})
