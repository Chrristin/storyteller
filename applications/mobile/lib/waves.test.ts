import assert from "node:assert/strict"

import { test } from "vitest"

import { blurhashAverageColor } from "./blurhash"
import { coverMainColor } from "./coverColor"
import {
  fallbackColor,
  generateWavePaths,
  hashString,
  seededRandom,
  wavePalette,
  wavePathsForBook,
} from "./waves"

test("hash and random are stable", () => {
  assert.equal(hashString("abc"), hashString("abc"))
  assert.notEqual(hashString("abc"), hashString("abd"))
  assert.equal(hashString(""), 0x811c9dc5)
  const a = seededRandom(1)
  const b = seededRandom(1)
  assert.equal(a(), b())
  const v = seededRandom(7)()
  assert.ok(v >= 0 && v < 1)
})

test("paths are stable per seed and differ between seeds", () => {
  assert.deepEqual(generateWavePaths(5), generateWavePaths(5))
  assert.notDeepEqual(generateWavePaths(5), generateWavePaths(6))
  assert.deepEqual(wavePathsForBook("x"), wavePathsForBook("x"))
})

test("four closed paths within bounds", () => {
  const paths = generateWavePaths(hashString("some-uuid"))
  assert.equal(paths.length, 4)
  for (const d of paths) {
    assert.ok(d.startsWith("M0,"))
    assert.ok(d.endsWith("L150,95 L0,95 Z"))
    const ys = [...d.matchAll(/[ML]([\d.]+),([\d.-]+)/g)]
      .map((m) => [Number(m[1]), Number(m[2])] as const)
      .filter(([x, y]) => !(y === 95 && (x === 150 || x === 0)))
    for (const [x, y] of ys) {
      assert.ok(x >= 0 && x <= 150)
      assert.ok(y >= -2 - 0.001 && y <= 14 + 3 * 17 + 6 + 16 + 0.001 + 1)
    }
  }
})

test("palette and fallback", () => {
  const p = wavePalette({ r: 100, g: 100, b: 100 })
  assert.equal(p.layers.length, 4)
  assert.equal(p.background, "#323232")
  assert.deepEqual(fallbackColor("u"), fallbackColor("u"))
})

test("blurhash average colour", () => {
  assert.equal(blurhashAverageColor("LEHV6nWB2yk8pyo0adR*.7kCMdnj"), "#979695")
  assert.equal(blurhashAverageColor("L00000"), "#000000")
  assert.equal(blurhashAverageColor(null), null)
  assert.equal(blurhashAverageColor("L"), null)
})

test("cover colour prefers colors then blurhash", () => {
  assert.equal(coverMainColor({ colors: [{ r: 255, g: 0, b: 16 }] }), "#ff0010")
  assert.equal(coverMainColor({ colors: [], blurhash: "L00000" }), "#000000")
  assert.equal(coverMainColor(null), null)
})
