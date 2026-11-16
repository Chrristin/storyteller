/** When an audiobook wave cover carries its own title and author. Pure helpers. */

/**
 * The title and author go inside the waves only when the cover is a list
 * cover, the waves are drawn, and "Titles under covers" is off (otherwise the
 * text would appear twice).
 */
export function shouldShowTitleOverlay({
  showTitleOverlay,
  waveFill,
  showTitles,
}: {
  showTitleOverlay: boolean
  waveFill: boolean
  showTitles: boolean
}): boolean {
  return showTitleOverlay && waveFill && !showTitles
}

/** Font sizes for the overlay text, scaled down a little on narrow covers. */
export function overlayFontSizes(width: number): {
  title: number
  author: number
} {
  const scale = Math.max(0.8, Math.min(1, width / 130))
  return {
    title: Math.round(13 * scale * 10) / 10,
    author: Math.round(11 * scale * 10) / 10,
  }
}
