import { useCallback } from "react"

import { getStatusByName } from "@/database/statuses"
import { STATUS_TO_READ, canAddToRead } from "@/lib/homeSections"
import { useAppDispatch } from "@/store/appState"
import { localApi } from "@/store/localApi"
import { serverApi } from "@/store/serverApi"
import { type UUID } from "@/uuid"

export interface ToReadBook {
  uuid: UUID
  serverUuid: UUID
  statusName: string | null
}

/**
 * Marks books "To read" or clears that mark. Adding sets the local status,
 * which the status sync pushes to the server. Removing tells the server first
 * (status null) and then drops the local status, so it needs a connection.
 */
export function useToReadActions() {
  const dispatch = useAppDispatch()

  const add = useCallback(
    async (
      books: readonly ToReadBook[],
      onProgress?: (done: number) => void,
    ) => {
      const status = await getStatusByName(STATUS_TO_READ)
      let done = 0
      for (const book of books) {
        // Reading and Read books keep their status.
        if (canAddToRead(book.statusName)) {
          await dispatch(
            localApi.endpoints.updateStatus.initiate({
              bookUuid: book.uuid,
              statusUuid: status.uuid,
            }),
          ).unwrap()
        }
        done += 1
        onProgress?.(done)
      }
    },
    [dispatch],
  )

  const remove = useCallback(
    async (
      books: readonly ToReadBook[],
      onProgress?: (done: number) => void,
    ) => {
      let done = 0
      for (const book of books) {
        if (book.statusName === STATUS_TO_READ) {
          await dispatch(
            serverApi.endpoints.updateStatus.initiate(
              {
                bookUuid: book.uuid,
                serverUuid: book.serverUuid,
                statusUuid: null,
              },
              { track: false },
            ),
          ).unwrap()
          await dispatch(
            localApi.endpoints.clearStatus.initiate({ bookUuid: book.uuid }),
          ).unwrap()
        }
        done += 1
        onProgress?.(done)
      }
    },
    [dispatch],
  )

  return { add, remove }
}
