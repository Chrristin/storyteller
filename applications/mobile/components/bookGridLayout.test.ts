import assert from "node:assert/strict"

import { test } from "vitest"

import { calculateBookGridLayout, pileTileWidth } from "./bookGridLayout"

const thumbnailHorizontalMargin = 12
const gridContainerPadding = 24

const rowFitsWithin = (availableWidth: number) => {
  const { numColumns, thumbnailWidth } = calculateBookGridLayout(availableWidth)

  return (
    numColumns * (thumbnailWidth + thumbnailHorizontalMargin) +
      gridContainerPadding <=
    availableWidth
  )
}

test("uses three columns on every phone width", () => {
  for (const width of [320, 360, 390, 412, 430, 599]) {
    assert.equal(calculateBookGridLayout(width).numColumns, 3, `width ${width}`)
  }
})

test("drops a column for the 84pt rail and keeps the row inside the rest", () => {
  const withoutRail = calculateBookGridLayout(1000)
  const withRail = calculateBookGridLayout(1000 - 84)

  assert.equal(withoutRail.numColumns, 6)
  assert.equal(withRail.numColumns, 5)
  assert.ok(rowFitsWithin(1000 - 84))
})

test("always returns whole columns that fit the width left by the safe area", () => {
  for (let width = 150; width <= 1400; width += 1) {
    const { numColumns, thumbnailWidth } = calculateBookGridLayout(width)

    assert.ok(
      numColumns >= 1 && thumbnailWidth > 0 && rowFitsWithin(width),
      `width ${width} laid out ${numColumns} columns of ${thumbnailWidth}`,
    )
  }
})

test("pile tiles use the same width as the Home book grid thumbnails", () => {
  assert.equal(
    pileTileWidth(350),
    calculateBookGridLayout(350 + 36).thumbnailWidth,
  )
  assert.equal(pileTileWidth(350), 108)
})
