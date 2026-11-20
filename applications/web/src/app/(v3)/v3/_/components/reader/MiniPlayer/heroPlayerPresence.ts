import { useEffect, useSyncExternalStore } from "react"

// A book details hero that shows its own player controls registers the book
// here, so the floating mini player can step aside for that book and the user
// never sees two sets of controls.
const shown = new Map<string, number>()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => {
    listener()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useRegisterHeroPlayer(bookUuid: string, active: boolean) {
  useEffect(() => {
    if (!active) return
    shown.set(bookUuid, (shown.get(bookUuid) ?? 0) + 1)
    emit()
    return () => {
      const next = (shown.get(bookUuid) ?? 1) - 1
      if (next <= 0) shown.delete(bookUuid)
      else shown.set(bookUuid, next)
      emit()
    }
  }, [bookUuid, active])
}

export function useHeroPlayerShown(bookUuid: string) {
  return useSyncExternalStore(
    subscribe,
    () => shown.has(bookUuid),
    () => false,
  )
}
