/**
 * Pure logic for swipeable piles (components/SwipePile.tsx): which index comes
 * next, whether a drag counts as a swipe, which dots to show, and the cap on
 * how many books a pile carries.
 */

/** A pile never carries more than this many books (cheap to hold, cheap to swipe). */
const PILE_BOOK_CAP = 30

/** Most dots shown under a pile. */
const MAX_DOTS = 5

/**
 * A drag past this share of the tile width is a swipe. It is small on purpose:
 * a short flick is enough, the cover is never dragged across the tile.
 */
const SWIPE_DISTANCE_RATIO = 0.12

/** A faster fling (px per second) is a swipe even for a short drag. */
const SWIPE_VELOCITY = 400

/** A fling must also have moved this far (px), so a twitch is not a swipe. */
const SWIPE_MIN_FLING_DISTANCE = 6

/** How far the front cover follows a finger, at most, as a share of the width. */
export const MAX_FOLLOW_RATIO = 0.25

/** How much of the finger's movement the front cover follows (it resists). */
export const FOLLOW_RESISTANCE = 0.4

/** Where a committed flick sends the front cover, as a share of the width. */
export const FLICK_OUT_RATIO = 0.55

/**
 * Where the front cover sits for a drag of `translationX` px: it follows the
 * finger with resistance and stops after a short distance, so it can be nudged
 * but not dragged across the tile.
 */
export function followOffset(translationX: number, width: number): number {
  "worklet"
  const max = width * MAX_FOLLOW_RATIO
  const moved = translationX * FOLLOW_RESISTANCE
  return Math.max(-max, Math.min(max, moved))
}

/** The first `PILE_BOOK_CAP` of an already ordered list. */
export function capPileBooks<T>(books: readonly T[]): T[] {
  return books.slice(0, PILE_BOOK_CAP)
}

/** The index after `index`, wrapping from the last book to the first. */
export function nextIndex(index: number, total: number): number {
  if (total <= 0) return 0
  return (index + 1) % total
}

/** The index before `index`, wrapping from the first book to the last. */
export function previousIndex(index: number, total: number): number {
  if (total <= 0) return 0
  return (index - 1 + total) % total
}

/** The index `step` places from `index` (any whole number, wraps both ways). */
export function stepIndex(index: number, total: number, step: number): number {
  if (total <= 0) return 0
  return (((index + step) % total) + total) % total
}

/**
 * What a finished drag does. Dragging left (negative translation) goes to the
 * next book (+1), dragging right goes to the previous (-1), anything below the
 * threshold springs back (0). With one book or none there is nothing to go to.
 */
export function swipeDecision(
  translationX: number,
  velocityX: number,
  width: number,
  total: number,
): -1 | 0 | 1 {
  "worklet"
  if (total < 2 || width <= 0) return 0
  const far = Math.abs(translationX) >= width * SWIPE_DISTANCE_RATIO
  const fling =
    Math.abs(velocityX) >= SWIPE_VELOCITY &&
    Math.abs(translationX) >= SWIPE_MIN_FLING_DISTANCE &&
    // A fling against the drag direction is a flick back, not a swipe.
    Math.sign(velocityX) === Math.sign(translationX)
  if (!far && !fling) return 0
  return translationX < 0 ? 1 : -1
}

/**
 * Dots under the pile. Up to five books get one dot each. With more, there
 * are always five dots and each stands for a fifth of the books (a bucket), so
 * the active dot moves from the first to the last as you go through the pile.
 */
export function dotWindow(
  index: number,
  total: number,
): { count: number; active: number } {
  if (total <= 0) return { count: 0, active: 0 }
  if (total <= MAX_DOTS) {
    return { count: total, active: Math.min(Math.max(index, 0), total - 1) }
  }
  const clamped = Math.min(Math.max(index, 0), total - 1)
  return {
    count: MAX_DOTS,
    active: Math.min(MAX_DOTS - 1, Math.floor((clamped * MAX_DOTS) / total)),
  }
}

/** The books whose edges peek out behind the front cover, wrapping around. */
export function peekIndexes(index: number, total: number): number[] {
  const out: number[] = []
  for (let step = 1; step <= 2 && step < total; step++) {
    out.push(stepIndex(index, total, step))
  }
  return out
}
