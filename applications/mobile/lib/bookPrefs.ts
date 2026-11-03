import AsyncStorage from "@react-native-async-storage/async-storage"
import { useSyncExternalStore } from "react"

/**
 * Per-book choices that live only on this phone: the format used last, whether
 * the book was closed (so opening it shows its page instead of resuming), a
 * rating and a favourite flag. They are kept out of the database on purpose,
 * so the schema and server sync stay as upstream has them.
 */
export type BookFormat = "readaloud" | "ebook" | "audiobook"

export type BookPrefs = {
  lastFormat?: BookFormat
  closed?: boolean
  rating?: number
  favourite?: boolean
}

const STORAGE_KEY = "storyteller.bookPrefs.v1"
const EMPTY: BookPrefs = {}

let prefs: Record<string, BookPrefs> = {}
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return
    // Anything set before the read finished wins over what was stored.
    prefs = { ...(JSON.parse(raw) as Record<string, BookPrefs>), ...prefs }
    emit()
  })
  .catch(() => {})

export function getBookPrefs(uuid: string): BookPrefs {
  return prefs[uuid] ?? EMPTY
}

export function setBookPrefs(uuid: string, patch: BookPrefs) {
  prefs = { ...prefs, [uuid]: { ...prefs[uuid], ...patch } }
  emit()
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch(() => {})
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useBookPrefs(uuid: string | undefined): BookPrefs {
  return useSyncExternalStore(subscribe, () =>
    uuid ? getBookPrefs(uuid) : EMPTY,
  )
}
