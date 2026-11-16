const gap = 12
const horizontalPadding = 36
const minThumbnailWidth = 150

/** Below this width (a phone) the grid is always three columns. */
const phoneMaxWidth = 600
const phoneColumns = 3

export function calculateBookGridLayout(widthOutsideSafeArea: number) {
  const numColumns =
    widthOutsideSafeArea < phoneMaxWidth
      ? phoneColumns
      : Math.max(
          phoneColumns,
          Math.floor(
            (widthOutsideSafeArea - horizontalPadding + gap) /
              (minThumbnailWidth + gap),
          ),
        )

  const thumbnailWidth = Math.floor(
    (widthOutsideSafeArea - horizontalPadding - (numColumns - 1) * gap) /
      numColumns,
  )

  return { numColumns, thumbnailWidth }
}
