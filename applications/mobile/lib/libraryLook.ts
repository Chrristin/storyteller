import AsyncStorage from "@react-native-async-storage/async-storage"
import { useCallback, useSyncExternalStore } from "react"

import {
  DEFAULT_LIBRARY_LOOK,
  type LibraryLook,
  normalizeLibraryLook,
} from "./libraryLookDefaults"

/**
 * The "Library look" choices from Settings. Like the per-book choices in
 * bookPrefs.ts they live only on this phone, in AsyncStorage, and are applied
 * as soon as they change.
 */
const STORAGE_KEY = "storyteller.libraryLook.v1"

let look: LibraryLook = DEFAULT_LIBRARY_LOOK
let changedBeforeLoad = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    // A change made before the read finished wins over what was stored.
    if (!raw || changedBeforeLoad) return
    look = normalizeLibraryLook(JSON.parse(raw))
    emit()
  })
  .catch(() => {})

export function getLibraryLook() {
  return look
}

export function setLibraryLook(patch: Partial<LibraryLook>) {
  changedBeforeLoad = true
  look = { ...look, ...patch }
  emit()
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(look)).catch(() => {})
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLibraryLook() {
  const current = useSyncExternalStore(subscribe, getLibraryLook)
  const update = useCallback((patch: Partial<LibraryLook>) => {
    setLibraryLook(patch)
  }, [])
  return [current, update] as const
}
