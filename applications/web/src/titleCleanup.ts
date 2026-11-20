import { baseNormalise } from "@/nameKey"

/**
 * Pure title clean-up. No database, no network, safe to import anywhere
 * (including the Hardcover matcher). It only ever removes known noise and
 * restores a missing leading article from a title that is already known; it
 * never invents or rewrites words.
 */

export type CleanTitleContext = {
  /** The book's position in any of its series. A leading number equal to one is a track number. */
  seriesPositions?: readonly number[]
  /** Titles known to be proper for this book (Hardcover match, other-format sibling). */
  knownTitles?: readonly string[]
}

export type CleanTitleResult = {
  title: string
  /** Human readable list of what was changed. Empty when nothing was. */
  changes: string[]
}

const NOISE_WORDS = "(?:unabridged|abridged|audio\\s?book|edition|version)"
const NOISE_CONTENT = `\\s*(?:${NOISE_WORDS}[\\s,&-]*)+`
/** "(Unabridged)", "[Audiobook]", "(Unabridged Audiobook)". */
const BRACKETED_NOISE = new RegExp(
  `\\s*(?:\\(${NOISE_CONTENT}\\)|\\[${NOISE_CONTENT}\\])`,
  "gi",
)
/** "Dune - Unabridged", "Dune: Audiobook" at the very end. */
const DASHED_NOISE = new RegExp(
  `(?:\\s*:\\s+|\\s+[-\\u2013\\u2014]\\s+)(?:unabridged|abridged|audio\\s?book)(?:\\s+(?:edition|version))?\\s*$`,
  "i",
)
/** A number at the very start followed by a separator: "01 ", "02. ", "14 - ". */
const LEADING_NUMBER = /^(\d{1,3})(?:\s*[.):]\s+|\s+-\s+|\s+)(?=\S)/
const LEADING_ARTICLE = /^(?:the|a|an)\s+/i

function collapse(title: string) {
  return title.replace(/\s+/g, " ").trim()
}

/** Lowercase, no punctuation, no leading article. */
export function bareTitleKey(title: string): string {
  return baseNormalise(title).replace(/^(?:the|a|an) /, "")
}

/** Strips "(Unabridged)" style noise. Returns the new title and what was removed. */
export function stripNoiseSuffix(title: string): {
  title: string
  removed: string[]
} {
  const removed: string[] = []
  let out = title.replace(BRACKETED_NOISE, (match) => {
    removed.push(match.trim())
    return " "
  })
  out = out.replace(DASHED_NOISE, (match) => {
    removed.push(match.trim())
    return ""
  })
  return { title: collapse(out), removed }
}

function isZeroPadded(digits: string) {
  // "01", "02", "014"; not "007" (a Bond number), not "0".
  return /^0\d{1,2}$/.test(digits) && digits !== "007"
}

/**
 * Strips a leading track number only when it is zero padded or equals the
 * book's series position. "1984", "7 Habits", "10 Rules" are left alone unless
 * the book really is that position of a series.
 */
export function stripLeadingTrackNumber(
  title: string,
  seriesPositions: readonly number[] = [],
): { title: string; removed: string | null } {
  const match = LEADING_NUMBER.exec(title)
  if (!match?.[1]) return { title, removed: null }
  const digits = match[1]
  const padded = isZeroPadded(digits)
  const isPosition =
    !padded && seriesPositions.some((position) => position === Number(digits))
  if (!padded && !isPosition) return { title, removed: null }
  const rest = collapse(title.slice(match[0].length))
  if (!rest) return { title, removed: null }
  return { title: rest, removed: digits }
}

function restoreArticle(title: string, knownTitles: readonly string[]) {
  if (LEADING_ARTICLE.test(title)) return null
  const key = bareTitleKey(title)
  if (!key) return null
  for (const known of knownTitles) {
    const candidate = collapse(known)
    if (!LEADING_ARTICLE.test(candidate)) continue
    // Same words, only the article differs. A candidate with brackets or other
    // extra words has a different key and is never used.
    if (bareTitleKey(candidate) === key) return candidate
  }
  return null
}

function cleanOnce(title: string, context: CleanTitleContext) {
  const changes: string[] = []
  let out = collapse(title)
  if (out !== title) changes.push("Trimmed extra spaces")

  const noise = stripNoiseSuffix(out)
  if (noise.removed.length > 0 && noise.title) {
    out = noise.title
    for (const removed of noise.removed) changes.push(`Removed "${removed}"`)
  }

  const track = stripLeadingTrackNumber(out, context.seriesPositions)
  if (track.removed) {
    out = track.title
    changes.push(`Removed track number "${track.removed}"`)
  }

  const restored = restoreArticle(out, context.knownTitles ?? [])
  if (restored) {
    changes.push(
      `Restored "${restored.split(" ")[0] ?? ""}" from the known title`,
    )
    out = restored
  }
  return { title: out, changes }
}

export function cleanTitle(
  title: string,
  context: CleanTitleContext = {},
): CleanTitleResult {
  const changes: string[] = []
  let current = title
  // Repeat until stable, so cleaning twice always equals cleaning once
  // ("01 01 Foo" needs two passes). Bounded, each pass only shortens the title
  // or adds one article.
  for (let pass = 0; pass < 4; pass++) {
    const step = cleanOnce(current, context)
    if (step.title === current) break
    changes.push(...step.changes)
    current = step.title
  }
  if (!current.trim()) return { title, changes: [] }
  return { title: current, changes }
}
