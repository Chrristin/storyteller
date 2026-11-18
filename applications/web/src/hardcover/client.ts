import { type HardcoverDoc } from "./match"

/**
 * A tiny Hardcover search client. Only the title and author go out, nothing
 * else about the book or the library.
 */

export const HARDCOVER_URL = "https://api.hardcover.app/v1/graphql"
const RATE_LIMIT_PAUSE_MS = 2_000

const SEARCH_QUERY = `query($q:String!){ search(query:$q, query_type:"Book", per_page:10){ results } }`

export class HardcoverAuthError extends Error {
  constructor() {
    super("Hardcover rejected the token. Check it in Settings, Metadata.")
    this.name = "HardcoverAuthError"
  }
}

export class HardcoverRateLimitError extends Error {
  constructor() {
    super("Hardcover says the free request limit was reached")
    this.name = "HardcoverRateLimitError"
  }
}

export class HardcoverError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HardcoverError"
  }
}

/** Accepts a stored token with or without a leading "Bearer ". */
export function authorizationHeader(token: string) {
  const bare = token.trim().replace(/^bearer\s+/i, "")
  return `Bearer ${bare}`
}

function isRateLimited(status: number, body: unknown) {
  if (status === 429) return true
  if (typeof body !== "object" || body === null) return false
  const error = (body as { error?: unknown }).error
  return typeof error === "string" && /too many requests/i.test(error)
}

export type SearchOptions = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function searchOnce(
  token: string,
  query: string,
  fetchImpl: typeof fetch,
): Promise<HardcoverDoc[]> {
  const response = await fetchImpl(HARDCOVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: authorizationHeader(token) } : {}),
    },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { q: query } }),
  })
  if (response.status === 401 || response.status === 403) {
    throw new HardcoverAuthError()
  }
  const body = (await response.json().catch(() => null)) as unknown
  if (isRateLimited(response.status, body)) throw new HardcoverRateLimitError()
  if (!response.ok) {
    throw new HardcoverError(
      `Hardcover answered with status ${response.status}`,
    )
  }
  const data = body as {
    errors?: { message?: string }[]
    data?: { search?: { results?: { hits?: { document?: HardcoverDoc }[] } } }
  } | null
  if (data?.errors?.length) {
    const message = data.errors[0]?.message ?? "unknown error"
    if (/invalid|unauthor|jwt/i.test(message)) throw new HardcoverAuthError()
    throw new HardcoverError(`Hardcover error: ${message}`)
  }
  const hits = data?.data?.search?.results?.hits ?? []
  return hits
    .map((hit) => hit.document)
    .filter((doc): doc is HardcoverDoc => !!doc)
}

/** Searches once, and once more after a pause when the rate limit is hit. */
export async function searchHardcover(
  token: string,
  query: string,
  { fetchImpl = fetch, sleep = defaultSleep }: SearchOptions = {},
): Promise<HardcoverDoc[]> {
  try {
    return await searchOnce(token, query, fetchImpl)
  } catch (error) {
    if (!(error instanceof HardcoverRateLimitError)) throw error
    await sleep(RATE_LIMIT_PAUSE_MS)
    return await searchOnce(token, query, fetchImpl)
  }
}
