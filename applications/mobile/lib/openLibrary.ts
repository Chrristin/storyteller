import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useState } from "react"

/**
 * Looks a book up on Open Library (public, no key) and returns the start of
 * its description. Results, including "nothing found", are cached on the phone
 * so each book is looked up once.
 */
type Cached = { text: string | null; fetchedAt: number }

const CACHE_PREFIX = "storyteller.openLibrary.v1."
const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const MAX_LENGTH = 700

function trimExcerpt(text: string) {
  const clean = text
    .replace(/\r/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/-{3,}[\s\S]*$/, "")
    .replace(/\n{2,}/g, "\n\n")
    .trim()
  if (clean.length <= MAX_LENGTH) return clean
  const cut = clean.slice(0, MAX_LENGTH)
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "))
  return (lastStop > MAX_LENGTH * 0.5 ? cut.slice(0, lastStop + 1) : cut) + "…"
}

async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Open Library ${response.status}`)
  return (await response.json()) as unknown
}

export async function fetchExcerpt(
  title: string,
  author: string | undefined,
  signal: AbortSignal,
): Promise<string | null> {
  const search = new URL("https://openlibrary.org/search.json")
  search.searchParams.set("title", title)
  if (author) search.searchParams.set("author", author)
  search.searchParams.set("limit", "1")
  search.searchParams.set("fields", "key")

  const found = (await fetchJson(search.toString(), signal)) as {
    docs?: { key?: string }[]
  }
  const key = found.docs?.[0]?.key
  if (!key) return null

  const work = (await fetchJson(
    `https://openlibrary.org${key}.json`,
    signal,
  )) as { description?: string | { value?: string } }
  const raw =
    typeof work.description === "string"
      ? work.description
      : work.description?.value
  return raw ? trimExcerpt(raw) : null
}

export function useOpenLibraryExcerpt(
  bookUuid: string,
  title: string,
  author: string | undefined,
) {
  const [excerpt, setExcerpt] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const key = CACHE_PREFIX + bookUuid

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(key)
        const cached = raw ? (JSON.parse(raw) as Cached) : null
        if (
          cached &&
          (cached.text || Date.now() - cached.fetchedAt < RETRY_AFTER_MS)
        ) {
          setExcerpt(cached.text)
          return
        }
        const text = await fetchExcerpt(title, author, controller.signal)
        setExcerpt(text)
        await AsyncStorage.setItem(
          key,
          JSON.stringify({ text, fetchedAt: Date.now() } satisfies Cached),
        )
      } catch {
        // Offline or Open Library is down: show nothing, try again next time.
      }
    }
    void load()
    return () => controller.abort()
  }, [bookUuid, title, author])

  return excerpt
}
