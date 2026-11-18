import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import { shallowEqual } from "react-redux"

import { type BookWithRelations } from "@/database/books"
import {
  type DriveResult,
  chunkBooks,
  driveErrorMessage,
  summarizeDriveResults,
} from "@/lib/driveSync"
import {
  type KindleResult,
  kindleBatches,
  kindleErrorMessage,
  summarizeKindleResults,
} from "@/lib/kindleSend"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { useListServersQuery } from "@/store/localApi"
import { serverApi } from "@/store/serverApi"
import { type UUID } from "@/uuid"

export interface ServerDelivery {
  drive: boolean
  kindle: boolean
  kindleAddress: string | null
}

/**
 * What THIS user can do on each server: Drive only if they connected their own
 * Google account, Kindle only if the server can send email and they saved an
 * address. Anything that is not a clear true (an unreachable server, or an
 * older server without /delivery) counts as not available, so nothing shows.
 */
export function useDelivery() {
  const dispatch = useAppDispatch()
  const { data: servers } = useListServersQuery()

  useEffect(() => {
    if (!servers) return
    const subscriptions = servers.map((server) =>
      dispatch(
        serverApi.endpoints.getDelivery.initiate({ serverUuid: server.uuid }),
      ),
    )
    return () => {
      subscriptions.forEach((subscription) => subscription.unsubscribe())
    }
  }, [dispatch, servers])

  // A string keeps the selector result stable between renders.
  const key = useAppSelector((state) =>
    JSON.stringify(
      (servers ?? []).map((server) => {
        const data = serverApi.endpoints.getDelivery.select({
          serverUuid: server.uuid,
        })(state).data
        return [
          server.uuid,
          data?.drive?.connected === true,
          data?.kindle?.available === true,
          data?.kindle?.defaultAddress ?? null,
        ]
      }),
    ),
  )

  return useMemo(() => {
    const map = new Map<UUID, ServerDelivery>()
    for (const [uuid, drive, kindle, address] of JSON.parse(key) as [
      UUID,
      boolean,
      boolean,
      string | null,
    ][]) {
      map.set(uuid, { drive, kindle, kindleAddress: address })
    }
    return map
  }, [key])
}

/** What this user can do with this book on its server. */
export function useBookDelivery(book: BookWithRelations | null | undefined) {
  const delivery = useDelivery()
  const info =
    canSend(book) && book.serverUuid ? delivery.get(book.serverUuid) : undefined
  return {
    drive: info?.drive === true,
    kindle: info?.kindle === true,
    kindleAddress: info?.kindleAddress ?? null,
  }
}

/** True when this book is on a server where this user has Drive connected. */
export function useDriveAvailable(book: BookWithRelations | null | undefined) {
  return useBookDelivery(book).drive
}

/** True when this book can be sent to this user's Kindle. */
export function useKindleAvailable(book: BookWithRelations | null | undefined) {
  return useBookDelivery(book).kindle
}

/** True when the book has an ebook and lives on a server. */
export function canSend(
  book: BookWithRelations | null | undefined,
): book is BookWithRelations & { serverUuid: UUID } {
  return !!book && book.serverUuid !== null && !!book.ebook
}

export const canSyncToDrive = canSend

// Selection mode for the library grids. One selection for the whole app; the
// screens that show the bars clear it when they go away.

export interface SelectedBook {
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
    async (
      books: readonly SelectedBook[],
      overwrite: boolean,
      onProgress?: (done: number) => void,
    ) => {
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
            onProgress?.(results.length)
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

/** Sends books to the user's Kindle in batches of 25, one after the other. */
export function useSendToKindle() {
  const dispatch = useAppDispatch()

  return useCallback(
    async (
      books: readonly SelectedBook[],
      onProgress?: (done: number) => void,
    ) => {
      const byServer = new Map<UUID, UUID[]>()
      const titles = new Map<string, string>()
      for (const book of books) {
        titles.set(book.uuid, book.title)
        byServer.set(book.serverUuid, [
          ...(byServer.get(book.serverUuid) ?? []),
          book.uuid,
        ])
      }

      const results: KindleResult[] = []
      const legacy = { sent: 0, skipped: 0 }
      let done = 0
      try {
        for (const [serverUuid, uuids] of byServer) {
          for (const batch of kindleBatches(uuids)) {
            const response = await dispatch(
              serverApi.endpoints.sendBooksToKindle.initiate({
                serverUuid,
                books: batch,
              }),
            ).unwrap()
            if (response.results) results.push(...response.results)
            else {
              legacy.sent += response.sent
              legacy.skipped += response.skipped
            }
            done += batch.length
            onProgress?.(done)
          }
        }
      } catch (error) {
        const summary = summarizeKindleResults(results, titles, legacy)
        const before =
          summary.sent || summary.skipped || summary.failed
            ? `${summary.summary} before it stopped. `
            : ""
        return {
          ok: false,
          message: `${before}${kindleErrorMessage(error)}`,
        } satisfies DriveBatchOutcome
      }
      const summary = summarizeKindleResults(results, titles, legacy)
      return {
        ok: true,
        message: summary.message,
      } satisfies DriveBatchOutcome
    },
    [dispatch],
  )
}

/**
 * Which of these books were already sent to the user's Kindle. Asks each
 * server once for the given books; a server that cannot answer (an older one)
 * counts as nothing sent.
 */
export function useKindleSentSet(books: readonly SelectedBook[]) {
  const dispatch = useAppDispatch()
  const key = JSON.stringify(
    [...new Set(books.map((b) => `${b.serverUuid}|${b.uuid}`))].sort(),
  )

  const requests = useMemo(() => {
    const byServer = new Map<UUID, UUID[]>()
    for (const entry of JSON.parse(key) as string[]) {
      const [serverUuid, uuid] = entry.split("|") as [UUID, UUID]
      byServer.set(serverUuid, [...(byServer.get(serverUuid) ?? []), uuid])
    }
    return [...byServer].map(([serverUuid, uuids]) => ({
      serverUuid,
      books: uuids,
    }))
  }, [key])

  useEffect(() => {
    const subscriptions = requests.map((request) =>
      dispatch(serverApi.endpoints.listKindleSent.initiate(request)),
    )
    return () => subscriptions.forEach((s) => s.unsubscribe())
  }, [dispatch, requests])

  const sentUuids = useAppSelector(
    (state) =>
      requests.flatMap((request) =>
        Object.keys(
          serverApi.endpoints.listKindleSent.select(request)(state).data ?? {},
        ),
      ),
    shallowEqual,
  )

  return useMemo(() => new Set<string>(sentUuids), [sentUuids])
}
