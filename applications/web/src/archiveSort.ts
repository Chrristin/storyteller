import { normaliseAuthorName } from "@/nameKey"

type SortableBook = {
  title: string
  authors: { name: string }[]
  series: { name: string; position: number | null; featured?: unknown }[]
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true })

function authorKey(book: SortableBook) {
  const name = book.authors[0]?.name
  return name ? normaliseAuthorName(name) : ""
}

/**
 * The Archive is ordered by author first, so spelling variants of one author
 * ("J.R.R. Tolkien", "J R R Tolkien") sit together, then by series name and
 * position, then by title. Books without an author sort last.
 */
export function compareByAuthorSeriesTitle(
  a: SortableBook,
  b: SortableBook,
): number {
  const ka = authorKey(a)
  const kb = authorKey(b)
  if (ka !== kb) {
    if (!ka) return 1
    if (!kb) return -1
    return collator.compare(ka, kb)
  }

  const sa = a.series[0]
  const sb = b.series[0]
  if (sa && sb) {
    const byName = collator.compare(sa.name, sb.name)
    if (byName !== 0) return byName
    const pa = sa.position ?? Number.POSITIVE_INFINITY
    const pb = sb.position ?? Number.POSITIVE_INFINITY
    if (pa !== pb) return pa < pb ? -1 : 1
  } else if (sa || sb) {
    // books in a series come before standalone books of the same author
    return sa ? -1 : 1
  }

  return collator.compare(a.title, b.title)
}
