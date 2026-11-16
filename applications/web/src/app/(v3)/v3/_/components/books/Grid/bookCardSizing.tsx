import type { GridCardSize } from "@/database/userPreferencesTypes"
import { type DisplayField, groupDisplayRows } from "@/sort"

export const TITLE_HEIGHT_FOR_CARD_SIZE: Record<GridCardSize, number> = {
  smallest: 34,
  small: 42,
  medium: 42,
  large: 42,
  largest: 42,
}

/**
 * Whether the text block is drawn under the card. It is off unless the
 * "Titles under covers" preference is on. Audiobook wave covers show their own
 * title and author over the waves when this is false.
 */
export function showMetaUnderCard(
  titlesUnderCovers: boolean,
  fields: DisplayField[],
): boolean {
  return titlesUnderCovers && fields.length > 0
}

/**
 * Height of the text block under a card, in px. It is 0 when the block is not
 * drawn, so the virtualised grid rows are exactly as tall as the cards. The row
 * gap is added separately by the grid geometry.
 */
export function metaHeightFor(
  fields: DisplayField[],
  gridCardSize: GridCardSize,
  titlesUnderCovers: boolean,
): number {
  if (!showMetaUnderCard(titlesUnderCovers, fields)) return 0
  const TOP = 8 // mt-2
  const LINE = 20 // one text-xs line + gap-0.5
  const rows = groupDisplayRows(fields)
  const titleRows = rows.filter((row) => row[0] === "title").length
  return (
    TOP +
    titleRows * TITLE_HEIGHT_FOR_CARD_SIZE[gridCardSize] +
    (rows.length - titleRows) * LINE
  )
}

/** "Title by Author" for tooltips and accessible names; just the title when there is no author. */
export function coverLabel(title: string, authorNames: string[]): string {
  return authorNames.length > 0
    ? `${title} by ${authorNames.join(", ")}`
    : title
}

export const COVER_ASPECT = 3 / 2 // cover box is aspect-2/3 -> height = width * 3/2
