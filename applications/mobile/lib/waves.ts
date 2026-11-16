/** Wave fill for the space below a square audiobook cover. Pure helpers. */

export const WAVE_WIDTH = 150
export const WAVE_HEIGHT = 95
const LAYERS = 4
const STEP = 3

/** A 32 bit FNV-1a hash of a string. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** A seeded LCG returning numbers in [0, 1). */
export function seededRandom(seedValue: number): () => number {
  let seed = seedValue >>> 0
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100
}

/** Four closed wave paths in a 150 by 95 box, back (light) to front (dark). */
export function generateWavePaths(seed: number): string[] {
  const r = seededRandom(seed)
  const paths: string[] = []
  for (let k = 0; k < LAYERS; k++) {
    const base = 14 + k * 17 + r() * 6
    const amp = 5 + r() * 11
    const cycles = 0.9 + r() * 1.9
    const phase = r() * 2 * Math.PI
    let d = ""
    for (let x = 0; x <= WAVE_WIDTH; x += STEP) {
      const y =
        base + amp * Math.sin((2 * Math.PI * cycles * x) / WAVE_WIDTH + phase)
      d += `${x === 0 ? "M" : "L"}${x},${round(y)} `
    }
    d += `L${WAVE_WIDTH},${WAVE_HEIGHT} L0,${WAVE_HEIGHT} Z`
    paths.push(d)
  }
  return paths
}

const cache = new Map<string, string[]>()
const CACHE_LIMIT = 500

/** Wave paths for a book, memoised by uuid. */
export function wavePathsForBook(uuid: string): string[] {
  const hit = cache.get(uuid)
  if (hit) return hit
  const paths = generateWavePaths(hashString(uuid))
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(uuid, paths)
  return paths
}

export type Rgb = { r: number; g: number; b: number }

/** Mix a colour toward white or black; amount 0 to 1. */
export function mix(color: Rgb, target: 0 | 255, amount: number): Rgb {
  const f = (c: number) => Math.round(c + (target - c) * amount)
  return { r: f(color.r), g: f(color.g), b: f(color.b) }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0")
  return `#${h(r)}${h(g)}${h(b)}`
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** A muted, stable colour for a book that has no cover colour yet. */
export function fallbackColor(uuid: string): Rgb {
  const hue = hashString(uuid) % 360
  const s = 0.28
  const l = 0.42
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x]
  return {
    r: Math.round((r! + m) * 255),
    g: Math.round((g! + m) * 255),
    b: Math.round((b! + m) * 255),
  }
}

/** The four layer fills (light to dark) and the card background. */
export function wavePalette(main: Rgb): {
  layers: string[]
  background: string
} {
  return {
    layers: [
      rgbToHex(mix(main, 255, 0.3)),
      rgbToHex(mix(main, 255, 0.12)),
      rgbToHex(mix(main, 0, 0.15)),
      rgbToHex(mix(main, 0, 0.38)),
    ],
    background: rgbToHex(mix(main, 0, 0.5)),
  }
}
