/**
 * Every book cover in a list leans a little, in a fixed pattern. The lean is
 * worked out from the book's id, so a book always leans the same way, on every
 * screen and every launch. How far it leans is the "Cover tilt" setting.
 */
export type TiltLevel = "off" | "subtle" | "medium" | "strong"

export const TILT_LEVELS: TiltLevel[] = ["off", "subtle", "medium", "strong"]

/** The largest lean in degrees, the largest vertical nudge in pixels, and the
 * fixed (left) lean of the big cover on the book page. */
export const TILT_STRENGTH: Record<
  TiltLevel,
  { maxDegrees: number; maxOffset: number; heroDegrees: number }
> = {
  off: { maxDegrees: 0, maxOffset: 0, heroDegrees: 0 },
  subtle: { maxDegrees: 1.6, maxOffset: 1.5, heroDegrees: -2 },
  medium: { maxDegrees: 3, maxOffset: 2.5, heroDegrees: -3.5 },
  strong: { maxDegrees: 5, maxOffset: 4, heroDegrees: -5 },
}

export type Tilt = { rotateDeg: number; translateY: number }

/** A small, stable 32 bit hash of a string (FNV-1a plus a final mix). */
function hash(value: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

const round = (value: number) => Math.round(value * 100) / 100 + 0

/** The lean for the book with this id: an angle and a vertical nudge. */
export function tiltFor(id: string, level: TiltLevel = "subtle"): Tilt {
  const { maxDegrees, maxOffset } = TILT_STRENGTH[level]
  const h = hash(id)
  const angle = (h & 0xffff) / 0xffff
  const offset = (h >>> 16) / 0xffff
  return {
    rotateDeg: round((angle * 2 - 1) * maxDegrees),
    translateY: round((offset * 2 - 1) * maxOffset),
  }
}

/** Ready for a style. Pass `straight` to switch the lean off for one book. */
export function tiltStyle(id: string, level: TiltLevel, straight = false) {
  if (straight || level === "off") return undefined
  const { rotateDeg, translateY } = tiltFor(id, level)
  return {
    transform: [{ translateY }, { rotate: `${rotateDeg}deg` }],
  }
}

/** The fixed lean for the book page's big cover. */
export function heroTiltStyle(level: TiltLevel) {
  const degrees = TILT_STRENGTH[level].heroDegrees
  if (degrees === 0) return undefined
  return { transform: [{ rotate: `${degrees}deg` }] }
}
