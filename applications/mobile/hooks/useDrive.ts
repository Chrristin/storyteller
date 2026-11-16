import { useCallback, useEffect, useSyncExternalStore } from "react"

import { type BookWithRelations } from "@/database/books"
import {
  type DriveResult,
  chunkBooks,
  driveErrorMessage,
  summarizeDriveResults,
} from "@/lib/driveSync"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { useListServersQuery } from "@/store/localApi"
import { serverApi } from "@/store/serverApi"
import { type UUID } from "@/uuid"

/**
 * Which servers have Google Drive set up and signed in. Anything that is not
 * a clear "connected: true" counts as not connected, so the Drive UI stays
 * hidden for people who do not use it, and when the server cannot be reached.
 */
export function useDriveServers() {
  const dispatch = useAppDispatch()
  const { data: servers } = useListServersQuery()

  useEffect(() => {
    if (!servers) return
    const subscriptions = servers.map((server) =>
      dispatch(
        serverApi.endpoints.getDriveStatus.initiate({
          serverUuid: server.uuid,
        }),
      ),
    )
    return () => {
      subscriptions.forEach((subscription) => subscription.unsubscribe())
    }
  }, [dispatch, servers])

  const connectedKey = useAppSelector((state) =>
    (servers ?? [])
      .filter(
        (server) =>
          serverApi.endpoints.getDriveStatus.select({
            serverUuid: server.uuid,
          })(state).data?.connected === true,
      )
      .map((server) => server.uuid)
      .join(","),
  )

  return connectedKey ? (connectedKey.split(",") as UUID[]) : []
}

/** True when this book is on a server that has Drive connected. */
export function useDriveAvailable(book: BookWithRelations | null | undefined) {
  const connected = useDriveServers()
  return canSyncToDrive(book) && connected.includes(book.serverUuid)
}

export function canSyncToDrive(
  book: BookWithRelations | null | undefined,
): book is BookWithRelations & { serverUuid: UUID } {
  return !!book && book.serverUuid !== null && !!book.ebook
}

// Selection mode for the library grids. One selection for the whole app; the
// screens that show the bars clear it when they go away.

interface SelectedBook {
  uuid: UUID
  title: string
  serverUuid: UUID
}

let selection = new Map<UUID, SelectedBook>()
const listeners = new Set<() => void>()

function setSelection(next: Map<UUID, SelectedBook>) {
  selection = next
  listeners.forEach((listener) => listener())
}

function toSelected(book: BookWithRelations): SelectedBook | null {
  if (!canSyncToDrive(book)) return null
  return { uuid: book.uuid, title: book.title, serverUuid: book.serverUuid }
}

export const driveSelection = {
  start(book: BookWithRelations) {
    const item = toSelected(book)
    if (!item || selection.size > 0) return
    setSelection(new Map([[item.uuid, item]]))
  },
  toggle(book: BookWithRelations) {
    const item = toSelected(book)
    if (!item) return
    const next = new Map(selection)
    if (next.has(item.uuid)) next.delete(item.uuid)
    else next.set(item.uuid, item)
    setSelection(next)
  },
  selectAll(books: readonly BookWithRelations[]) {
    const next = new Map<UUID, SelectedBook>()
    for (const book of books) {
      const item = toSelected(book)
      if (item) next.set(item.uuid, item)
    }
    setSelection(next)
  },
  clear() {
    if (selection.size > 0) setSelection(new Map())
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDriveSelection() {
  const current = useSyncExternalStore(subscribe, () => selection)
  return current
}

export function useIsDriveSelected(uuid: UUID) {
  return useSyncExternalStore(subscribe, () => selection.has(uuid))
}

export type DriveBatchOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string }

/** Copies books to Drive in batches of 25, one batch after the other. */
export function useSyncToDrive() {
  const dispatch = useAppDispatch()

  return useCallback(
    async (books: readonly SelectedBook[], overwrite: boolean) => {
      const byServer = new Map<UUID, UUID[]>()
      for (const book of books) {
        byServer.set(book.serverUuid, [
          ...(byServer.get(book.serverUuid) ?? []),
          book.uuid,
        ])
      }

      const results: DriveResult[] = []
      try {
        for (const [serverUuid, uuids] of byServer) {
          for (const batch of chunkBooks(uuids)) {
            const response = await dispatch(
              serverApi.endpoints.syncBooksToDrive.initiate({
                serverUuid,
                books: batch,
                overwrite,
              }),
            ).unwrap()
            results.push(...response.results)
          }
        }
      } catch (error) {
        const done = results.length
          ? `${summarizeDriveResults(results).summary} before it stopped. `
          : ""
        return {
          ok: false,
          message: `${done}${driveErrorMessage(error)}`,
        } satisfies DriveBatchOutcome
      }
      return {
        ok: true,
        message: summarizeDriveResults(results).message,
      } satisfies DriveBatchOutcome
    },
    [dispatch],
  )
}
