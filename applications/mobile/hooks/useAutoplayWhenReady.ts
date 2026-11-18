import { useEffect, useRef } from "react"
import { useStore } from "react-redux"

import { type BookFormat } from "@/lib/bookPrefs"
import { Storyteller } from "@/modules/readium"
import { type RootState, useAppSelector } from "@/store/appState"

/**
 * Starts playback once, after a book was opened with the autoplay route param.
 *
 * "Ready" is read from the live store, not from render values, because the
 * screen dispatches bookOpened in an effect and the values of that same render
 * are still the previous book's. The open listener dispatches playerQueued
 * (which clears isAudioLoading) and then calls seekTo, so the play call from
 * this effect is made after seekTo was invoked.
 */
export function useAutoplayWhenReady({
  enabled,
  uuid,
  format,
  ready = true,
}: {
  enabled: boolean
  uuid: string
  format: BookFormat
  /** Extra condition from the screen, for example the reader being mounted. */
  ready?: boolean
}) {
  const store = useStore<RootState>()
  const done = useRef(false)
  const isLoading = useAppSelector((state) => state.bookshelf.isAudioLoading)
  const trackCount = useAppSelector((state) => state.bookshelf.tracks.length)

  useEffect(() => {
    if (!enabled || done.current || !ready) return
    const state = store.getState().bookshelf
    if (
      state.isAudioLoading ||
      state.tracks.length === 0 ||
      state.currentlyPlayingBookUuid !== uuid ||
      state.currentlyPlayingFormat !== format
    ) {
      return
    }
    done.current = true
    Storyteller.play(true).catch(() => {})
  }, [enabled, ready, uuid, format, isLoading, trackCount, store])
}
