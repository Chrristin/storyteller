/**
 * Pure rules for the "Currently reading" row on Home: the book read last gets
 * the big card, the other books in progress are small overlapping circles.
 */

/** How many circles the row shows before it runs out of room. */
export const MAX_NOW_READING_CIRCLES = 5

/** The Now Reading page: the shelf screen that lists every book in progress. */
export const NOW_READING_SHELF_TYPE = "currently-reading"
export const NOW_READING_TITLE = "Now Reading"

interface InProgressBook {
  uuid: string
  position?: { timestamp: number } | null
}

/** Books with status "Reading", the one read most recently first. */
export function sortInProgress<T extends InProgressBook>(books: readonly T[]) {
  return [...books].sort(
    (a, b) => (b.position?.timestamp ?? 0) - (a.position?.timestamp ?? 0),
  )
}

/**
 * The books shown as circles under the big card: everything in progress except
 * the book on the card (the first one), capped at `max`. Expects the books
 * newest read first, as `sortInProgress` gives them.
 */
export function circleBooks<T extends InProgressBook>(
  inProgress: readonly T[],
  max = MAX_NOW_READING_CIRCLES,
) {
  return inProgress.slice(1, 1 + max)
}
