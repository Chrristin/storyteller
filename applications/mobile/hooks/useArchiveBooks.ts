import { useCallback } from "react"

import { setBooksArchivedAt } from "@/database/books"
import {
  type ArchiveTarget,
  archiveErrorMessage,
  archiveResultMessage,
  buildArchiveRequest,
  groupByServer,
} from "@/lib/archive"
import { useAppDispatch } from "@/store/appState"
import { localApi } from "@/store/localApi"
import { serverApi } from "@/store/serverApi"
import { type UUID } from "@/uuid"

export type ArchiveOutcome = { ok: boolean; message: string }

/**
 * Moves books to the Archive, or back to the library, for everybody: one POST
 * per server. The phone's rows change at once (optimistic, undone for a server
 * that refuses), then the books of those servers are read again so the sync
 * listener replaces them with the server's values.
 */
export function useArchiveBooks() {
  const dispatch = useAppDispatch()

  return useCallback(
    async (
      books: readonly ArchiveTarget[],
      archived: boolean,
    ): Promise<ArchiveOutcome> => {
      const groups = groupByServer(books)
      const total =
        groups.local.length +
        groups.servers.reduce((n, s) => n + s.bookUuids.length, 0)
      if (total === 0) return { ok: true, message: "" }

      const now = archived ? new Date().toISOString() : null
      const previous = new Map(
        books.map((book) => [book.uuid, book.archivedAt ?? null]),
      )
      const entries = (uuids: string[], value: string | null) =>
        uuids.map((uuid) => ({ uuid: uuid as UUID, archivedAt: value }))
      const restore = (uuids: string[]) =>
        setBooksArchivedAt(
          uuids.map((uuid) => ({
            uuid: uuid as UUID,
            archivedAt: previous.get(uuid) ?? null,
          })),
        )

      const all = [
        ...groups.local,
        ...groups.servers.flatMap((s) => s.bookUuids),
      ]
      await setBooksArchivedAt(entries(all, now))

      let done = groups.local.length
      const changed: string[] = []
      let failure: unknown = null
      for (const { serverUuid, bookUuids } of groups.servers) {
        const request = buildArchiveRequest(bookUuids, archived)
        try {
          await dispatch(
            serverApi.endpoints.postServerJson.initiate({
              serverUuid: serverUuid as UUID,
              url: request.url,
              body: request.body,
            }),
          ).unwrap()
          done += bookUuids.length
          changed.push(serverUuid)
        } catch (error) {
          failure ??= error
          await restore(bookUuids)
        }
      }

      if (changed.length) await refresh(changed)
      dispatch(localApi.util.invalidateTags(["Books"]))

      if (failure) {
        const prefix = done ? `${archiveResultMessage(done, archived)} ` : ""
        return {
          ok: false,
          message: `${prefix}${archiveErrorMessage(failure)}`,
        }
      }
      return { ok: true, message: archiveResultMessage(done, archived) }

      async function refresh(serverUuids: string[]) {
        await Promise.all(
          serverUuids.map(async (serverUuid) => {
            const request = dispatch(
              serverApi.endpoints.listBooks.initiate(
                { serverUuid: serverUuid as UUID },
                { forceRefetch: true },
              ),
            )
            try {
              await request.unwrap()
            } catch {
              // Saved on the server; the next sync shows it.
            } finally {
              request.unsubscribe()
            }
          }),
        )
      }
    },
    [dispatch],
  )
}
