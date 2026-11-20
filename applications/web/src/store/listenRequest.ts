import type { ReadingMode } from "@/store/slices/readingSessionSlice"
import type { UUID } from "@/uuid"

// pure helpers behind "Listen" buttons: they decide what to do with the shared
// reader audio player, and watch the store to see how a load turned out.

export type ListenAction = "unavailable" | "play" | "start"

export function decideListenAction(input: {
  hasAudiobook: boolean
  sessionBookUuid: UUID | null
  sessionMode: ReadingMode
  currentTrackUrl: string | null
  bookUuid: UUID
}): ListenAction {
  if (!input.hasAudiobook) return "unavailable"
  const alreadyLoaded =
    input.sessionBookUuid === input.bookUuid &&
    input.sessionMode === "audiobook" &&
    input.currentTrackUrl !== null &&
    input.currentTrackUrl.includes(`/api/v2/books/${input.bookUuid}/`)
  return alreadyLoaded ? "play" : "start"
}

export type ListenProgress =
  | { status: "pending" }
  | { status: "ready" }
  | { status: "error"; message: string }

type ListenProgressState = {
  readingSession: { error: string | null; errorMessage: string | null }
  audioPlayer: { currentTrack: { url?: string | undefined } | null }
}

export function evaluateListenProgress(
  state: ListenProgressState,
  bookUuid: UUID,
): ListenProgress {
  if (state.readingSession.error) {
    return {
      status: "error",
      message: state.readingSession.errorMessage ?? state.readingSession.error,
    }
  }
  const url = state.audioPlayer.currentTrack?.url
  if (url?.includes(`/api/v2/books/${bookUuid}/`)) return { status: "ready" }
  return { status: "pending" }
}

export type ListenButtonState = "idle" | "paused" | "playing"

// state of a book's Listen button: "idle" when another book (or none) is in the
// shared player, "paused" when this audiobook is loaded but not playing, and
// "playing" while it plays.
export function listenButtonState(input: {
  sessionBookUuid: UUID | null
  sessionMode: ReadingMode
  hasTrack: boolean
  playing: boolean
  bookUuid: UUID
}): ListenButtonState {
  const loaded =
    input.sessionBookUuid === input.bookUuid &&
    input.sessionMode === "audiobook" &&
    input.hasTrack
  if (!loaded) return "idle"
  return input.playing ? "playing" : "paused"
}
