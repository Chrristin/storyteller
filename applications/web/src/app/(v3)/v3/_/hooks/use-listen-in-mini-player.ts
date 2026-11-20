"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import { useTranslation } from "@v3/_/hooks/use-translation"

import type { BookWithRelations } from "@/database/books"
import { readerPlayer } from "@/services/AudioPlayerService"
import { closeMiniPlayer } from "@/store/actions"
import { useAppDispatch, useAppStore } from "@/store/appState"
import {
  decideListenAction,
  evaluateListenProgress,
} from "@/store/listenRequest"
import { readingSessionSlice } from "@/store/slices/readingSessionSlice"

const LOAD_TIMEOUT_MS = 60_000

// Loads an audiobook into the shared reader player and starts it, without
// leaving the current page. The floating mini player (mounted in the app
// layout) shows up by itself once a reading session and a track exist. Loading,
// resuming from the saved position and progress syncing all live in the
// startBook listener, so this works the same as opening the read page.
export function useListenInMiniPlayer() {
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const t = useTranslation("Reader.miniPlayer")

  return useCallback(
    (book: BookWithRelations) => {
      const state = store.getState()
      const action = decideListenAction({
        hasAudiobook: book.audiobook !== null,
        sessionBookUuid: state.readingSession.currentbook?.uuid ?? null,
        sessionMode: state.readingSession.mode,
        currentTrackUrl: state.audioPlayer.currentTrack?.url ?? null,
        bookUuid: book.uuid,
      })

      const fail = (message?: string) => {
        dispatch(readingSessionSlice.actions.clearReaderError())
        dispatch(closeMiniPlayer())
        toast.error(t.plain("listenFailed"), {
          ...(message ? { description: message } : {}),
        })
      }

      if (action === "unavailable") {
        toast.error(t.plain("noAudiobook"))
        return
      }

      if (action === "play") {
        // already loaded: resume inside the click so the browser allows it
        readerPlayer()
          .play()
          .catch((error: unknown) => {
            console.error("Failed to resume audiobook:", error)
            fail(error instanceof Error ? error.message : undefined)
          })
        return
      }

      dispatch(
        readingSessionSlice.actions.startBook({
          book,
          requestedMode: "audiobook",
          autoplay: true,
        }),
      )

      // watch the load so a failure shows a toast instead of failing silently
      let timer: ReturnType<typeof setTimeout> | undefined
      const unsubscribe = store.subscribe(() => {
        const progress = evaluateListenProgress(store.getState(), book.uuid)
        if (progress.status === "pending") return
        unsubscribe()
        clearTimeout(timer)
        if (progress.status === "error") fail(progress.message)
      })
      timer = setTimeout(unsubscribe, LOAD_TIMEOUT_MS)
    },
    [dispatch, store, t],
  )
}
