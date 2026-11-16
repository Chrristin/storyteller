import { describe, expect, it } from "vitest"

import {
  WAVE_LAYER_COUNT,
  WAVE_VIEWBOX,
  createRandom,
  generateWaves,
  hashSeed,
  mixWithBlack,
  mixWithWhite,
  waveColors,
  wavePaths,
} from "../coverWaves"

describe("hashSeed", () => {
  it("matches known FNV-1a values", () => {
    expect(hashSeed("")).toBe(0x811c9dc5)
    expect(hashSeed("a")).toBe(0xe40c292c)
  })
})

describe("createRandom", () => {
  it("is stable and stays in [0, 1)", () => {
    const a = createRandom(42)
    const b = createRandom(42)
    for (let i = 0; i < 100; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it("follows the documented LCG", () => {
    const next = ((1 * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
    expect(createRandom(1)()).toBe(next)
  })
})

describe("wavePaths", () => {
  it("is stable for the same seed", () => {
    expect(wavePaths(hashSeed("book-1"))).toEqual(wavePaths(hashSeed("book-1")))
  })

  it("differs across seeds", () => {
    expect(wavePaths(hashSeed("book-1"))).not.toEqual(
      wavePaths(hashSeed("book-2")),
    )
  })

  it("makes four closed paths that sample every 3 units", () => {
    const paths = wavePaths(hashSeed("book-1"))
    expect(paths).toHaveLength(WAVE_LAYER_COUNT)
    for (const path of paths) {
      expect(path.startsWith("M0,")).toBe(true)
      expect(path.endsWith("L150,95 L0,95 Z")).toBe(true)
      expect(path.split(" L")).toHaveLength(51 + 2)
    }
  })

  it("stays inside the viewBox vertically", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      for (const path of wavePaths(hashSeed(seed))) {
        const ys = [...path.matchAll(/(?:M|L)[\d.]+,(-?[\d.]+)/g)].map((m) =>
          Number(m[1]),
        )
        for (const y of ys) {
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThanOrEqual(WAVE_VIEWBOX.height)
        }
      }
    }
  })
})

describe("colour mixing", () => {
  it("mixes with white and black", () => {
    expect(mixWithWhite({ r: 0, g: 100, b: 200 }, 0.3)).toEqual({
      r: 77,
      g: 147,
      b: 217,
    })
    expect(mixWithBlack({ r: 100, g: 200, b: 50 }, 0.5)).toEqual({
      r: 50,
      g: 100,
      b: 25,
    })
  })

  it("orders layers light to dark", () => {
    const { layers, background } = waveColors({ r: 100, g: 100, b: 100 })
    const reds = layers.map((c) => c.r)
    expect(reds).toEqual([...reds].sort((a, b) => b - a))
    expect(background.r).toBe(50)
  })

  it("builds css fills", () => {
    const fill = generateWaves("x", { r: 100, g: 100, b: 100 })
    expect(fill.background).toBe("rgb(50 50 50)")
    expect(fill.layers).toHaveLength(4)
    expect(fill.layers[0]?.fill).toBe("rgb(147 147 147)")
  })
})
