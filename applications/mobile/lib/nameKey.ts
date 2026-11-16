/**
 * Pure name normalisation shared by the server and the client. Two names are
 * only treated as the same when their keys are equal. There is no fuzzy
 * matching. Do not import database or server code here.
 */

export function baseNormalise(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/['‘’ʼ`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function normaliseAuthorName(name: string): string {
  const tokens = baseNormalise(name).split(" ").filter(Boolean)
  const out: string[] = []
  let initials = ""
  const flush = () => {
    if (initials) out.push(initials)
    initials = ""
  }
  for (const token of tokens) {
    if ([...token].length === 1) {
      initials += token
    } else {
      flush()
      out.push(token)
    }
  }
  flush()
  return out.join(" ")
}

export function normaliseSeriesName(name: string): string {
  let key = baseNormalise(name)
  const stripped = key
    .replace(/^the /, "")
    .replace(/ (series|saga|trilogy|cycle)$/, "")
  // Never reduce a name to nothing, for example a series called "The Series".
  if (stripped) key = stripped
  return key
}

function hasProperCase(name: string): boolean {
  return name !== name.toLowerCase() && name !== name.toUpperCase()
}

/**
 * Chooses the display name and representative of a group of entries with the
 * same key: the name used by most books, then proper capitalisation, then the
 * longest, then alphabetical and smallest uuid so the result is stable.
 */
export function chooseCanonical<
  T extends { uuid: string; name: string; books: number },
>(entities: T[]): T {
  const sorted = [...entities].sort(
    (a, b) =>
      b.books - a.books ||
      Number(hasProperCase(b.name)) - Number(hasProperCase(a.name)) ||
      b.name.length - a.name.length ||
      a.name.localeCompare(b.name) ||
      a.uuid.localeCompare(b.uuid),
  )
  return sorted[0] as T
}
