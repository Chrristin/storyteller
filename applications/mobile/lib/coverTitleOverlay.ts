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

/**
 * Font sizes for the overlay text. They are the same on every cover width.
 * Text that does not fit is cut off with an ellipsis (the author after one
 * line, the title after two) so it always stays inside the image.
 */
export const OVERLAY_FONT_SIZES = { title: 13, author: 11 } as const

export const OVERLAY_TITLE_LINES = 2
export const OVERLAY_AUTHOR_LINES = 1
