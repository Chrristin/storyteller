import type { GridCardSize } from "@/database/userPreferencesTypes"
import { type DisplayField, groupDisplayRows } from "@/sort"

export const TITLE_HEIGHT_FOR_CARD_SIZE: Record<GridCardSize, number> = {
  smallest: 34,
  small: 42,
  medium: 42,
  large: 42,
  largest: 42,
}

export function metaHeightFor(
  fields: DisplayField[],
  gridCardSize: GridCardSize,
): number {
  if (fields.length === 0) return 0
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

export const COVER_ASPECT = 3 / 2 // cover box is aspect-2/3 -> height = width * 3/2
