import { useCallback, useMemo } from "react"

import { postJson, refetchServerBooks } from "@/hooks/serverCalls"
import {
  type AddRequest,
  type SelectedRef,
  type Target,
  type TargetKind,
  addErrorMessage,
  buildAddRequest,
  buildCreateCollectionRequest,
  buildTargets,
  planAdd,
  summarizeAdd,
} from "@/lib/addToCollection"
import { useAppDispatch } from "@/store/appState"
import {
  localApi,
  useListBooksQuery,
  useListCollectionsQuery,
} from "@/store/localApi"

/** Everything the selected books can be added to, from the local library. */
export function useAddTargets() {
  const { data: books } = useListBooksQuery()
  const { data: collections } = useListCollectionsQuery()
  return useMemo(
    () => buildTargets(books ?? [], collections ?? []),
    [books, collections],
  )
}

export type AddOutcome = { ok: boolean; message: string }

/**
 * Adds the selected books to an existing item (`target`) or to a new one
 * called `name`, on each server the books are on. Never removes anything.
 * Afterwards it re-reads the books of the servers it changed, so the new
 * membership shows on the phone.
 */
export function useAddToCollection() {
  const dispatch = useAppDispatch()
  const { data: books } = useListBooksQuery()

  return useCallback(
    async (input: {
      kind: TargetKind
      name: string
      target: Target | null
      selected: readonly SelectedRef[]
    }): Promise<AddOutcome> => {
      const { kind, target } = input
      const plan = planAdd({ ...input, books: books ?? [] })
      const name = target?.name ?? input.name.trim()
      const post = (serverUuid: string, request: AddRequest) =>
        postJson(dispatch, serverUuid, request.url, request.body)

      let added = 0
      let alreadyIn = 0
      const changed: string[] = []
      try {
        for (const serverPlan of plan.plans) {
          alreadyIn += serverPlan.alreadyIn
          if (serverPlan.bookUuids.length === 0) continue
          let collectionUuid: string | undefined
          if (kind === "collection" && !serverPlan.ref) {
            const created = (await post(
              serverPlan.serverUuid,
              buildCreateCollectionRequest(serverPlan.name),
            )) as { uuid?: string } | null
            collectionUuid = created?.uuid
            changed.push(serverPlan.serverUuid)
          }
          const request = buildAddRequest(kind, serverPlan, collectionUuid)
          if (!request) continue
          await post(serverPlan.serverUuid, request)
          added += serverPlan.bookUuids.length
          if (!changed.includes(serverPlan.serverUuid)) {
            changed.push(serverPlan.serverUuid)
          }
        }
      } catch (error) {
        const done = added
          ? `${summarizeAdd({ added, alreadyIn: 0, skipped: 0, name })} `
          : ""
        if (changed.length) await refresh(changed)
        return {
          ok: false,
          message: `${done}${addErrorMessage(error, kind, name)}`,
        }
      }

      if (changed.length) await refresh(changed)
      return {
        ok: true,
        message: summarizeAdd({
          added,
          alreadyIn,
          skipped: plan.skipped.length,
          name,
        }),
      }

      async function refresh(serverUuids: string[]) {
        // Re-reading the books makes the sync listener update the local
        // tables, which the library screens watch.
        await refetchServerBooks(dispatch, serverUuids)
        dispatch(
          localApi.util.invalidateTags([
            "Books",
            "Collections",
            "Series",
            "Tags",
            "Creators",
          ]),
        )
      }
    },
    [books, dispatch],
  )
}
