/**
 * Server calls shared by the hooks that act on a selection of books (Archive,
 * Add to collection). The pure helpers are in lib/serverBatch.ts, kept apart
 * so they can be tested without the store.
 */

import { type AppDispatch } from "@/store/appState"
import { serverApi } from "@/store/serverApi"
import { type UUID } from "@/uuid"

/** A plain POST to a server route. Throws what the request threw. */
export function postJson(
  dispatch: AppDispatch,
  serverUuid: string,
  url: string,
  body: unknown,
) {
  return dispatch(
    serverApi.endpoints.postServerJson.initiate({
      serverUuid: serverUuid as UUID,
      url,
      body,
    }),
  ).unwrap()
}

/**
 * Reads the books of these servers again, so the sync listener updates the
 * local tables. A server that cannot answer is ignored: the change is saved on
 * the server and the next sync shows it.
 */
export async function refetchServerBooks(
  dispatch: AppDispatch,
  serverUuids: readonly string[],
) {
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
