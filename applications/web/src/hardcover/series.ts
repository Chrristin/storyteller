import { normaliseSeriesName } from "@/nameKey"

/**
 * Hardcover lists several series for one book, for example
 * ["The Expanse", "The Expanse (Chronological)"]. This picks the one a library
 * should use, and the book's position in it.
 */

export type FeaturedSeries = {
  position?: number | string | null
  series?: { name?: string | null } | null
} | null

export type PrimarySeries = {
  name: string | null
  /** The position to keep, or null. Only set when it belongs to `name`. */
  position: number | null
}

const NOT_PRIMARY =
  /chronolog|publication order|reading order|universe|omnibus|\btpb\b/i

export function isPrimarySeriesName(name: string) {
  return name.trim() !== "" && !NOT_PRIMARY.test(name)
}

/**
 * A position is kept when it is a positive whole number or a half step like
 * 2.5 (a novella between two books). Anything else is dropped.
 */
export function cleanPosition(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value) : value
  if (typeof number !== "number" || !Number.isFinite(number)) return null
  if (number <= 0) return null
  return Number.isInteger(number * 2) ? number : null
}

/** Only whole positive numbers go into the series relation. */
export function isWholePosition(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

export function pickPrimarySeries({
  seriesNames,
  featuredSeries,
  existingSeries = [],
}: {
  seriesNames: readonly string[] | null | undefined
  featuredSeries?: FeaturedSeries | undefined
  existingSeries?: readonly string[]
}): PrimarySeries {
  const featuredName = featuredSeries?.series?.name?.trim() || null

  if (featuredName && isPrimarySeriesName(featuredName)) {
    return {
      name: featuredName,
      position: cleanPosition(featuredSeries?.position),
    }
  }

  const candidates = (seriesNames ?? []).filter(
    (name): name is string =>
      typeof name === "string" && isPrimarySeriesName(name),
  )
  if (candidates.length === 0) return { name: null, position: null }

  const existingKeys = new Set(existingSeries.map(normaliseSeriesName))
  const known = candidates.filter((name) =>
    existingKeys.has(normaliseSeriesName(name)),
  )
  const pool = known.length > 0 ? known : candidates
  const name = [...pool].sort(
    (a, b) => a.length - b.length || a.localeCompare(b),
  )[0] as string

  // The featured position belongs to the featured series. Use it only when we
  // ended up on that same series.
  const position =
    featuredName &&
    normaliseSeriesName(featuredName) === normaliseSeriesName(name)
      ? cleanPosition(featuredSeries?.position)
      : null

  return { name, position }
}
