/**
 * Order of the Archive screen: by first author (spelling variants together),
 * then series name and position, then title. Books without an author last.
 */

import { normaliseAuthorName, normaliseSeriesName } from "./nameKey"

export interface ArchiveOrderBook {
  title: string
  authors: { name: string }[]
  series: {
    name: string
    position?: string | number | null
    featured?: unknown
  }[]
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
}

function authorKey(book: ArchiveOrderBook) {
  const name = book.authors[0]?.name
  return name ? normaliseAuthorName(name) : ""
}

function seriesOf(book: ArchiveOrderBook) {
  const entry =
    book.series.find((s) => s.featured === true || s.featured === "true") ??
    book.series[0]
  if (!entry) return null
  const position = Number(entry.position)
  return {
    key: normaliseSeriesName(entry.name),
    position:
      Number.isFinite(position) &&
      entry.position !== null &&
      entry.position !== ""
        ? position
        : Infinity,
  }
}

export function compareArchiveBooks(a: ArchiveOrderBook, b: ArchiveOrderBook) {
  const authorA = authorKey(a)
  const authorB = authorKey(b)
  if (authorA !== authorB) {
    if (!authorA) return 1
    if (!authorB) return -1
    return compareText(authorA, authorB)
  }
  const seriesA = seriesOf(a)
  const seriesB = seriesOf(b)
  if (seriesA && seriesB) {
    if (seriesA.key !== seriesB.key)
      return compareText(seriesA.key, seriesB.key)
    if (seriesA.position !== seriesB.position) {
      return seriesA.position < seriesB.position ? -1 : 1
    }
  } else if (seriesA) {
    return -1
  } else if (seriesB) {
    return 1
  }
  return compareText(a.title, b.title)
}

export function sortArchiveBooks<T extends ArchiveOrderBook>(
  books: readonly T[],
) {
  return [...books].sort(compareArchiveBooks)
}
