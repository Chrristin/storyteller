/**
 * Order of the Archive screen: by first author's name (ignoring case and accents),
 * then series name and position, then title. Books without an author last.
 */

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

function seriesOf(book: ArchiveOrderBook) {
  const entry =
    book.series.find((s) => s.featured === true || s.featured === "true") ??
    book.series[0]
  if (!entry) return null
  const position = Number(entry.position)
  return {
    name: entry.name,
    position:
      Number.isFinite(position) &&
      entry.position !== null &&
      entry.position !== ""
        ? position
        : Infinity,
  }
}

export function compareArchiveBooks(a: ArchiveOrderBook, b: ArchiveOrderBook) {
  const authorA = a.authors[0]?.name
  const authorB = b.authors[0]?.name
  if (!authorA !== !authorB) return authorA ? -1 : 1
  if (authorA && authorB) {
    const byAuthor = compareText(authorA, authorB)
    if (byAuthor !== 0) return byAuthor
  }
  const seriesA = seriesOf(a)
  const seriesB = seriesOf(b)
  if (seriesA && seriesB) {
    const byName = compareText(seriesA.name, seriesB.name)
    if (byName !== 0) return byName
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
