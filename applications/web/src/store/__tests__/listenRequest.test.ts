import assert from "node:assert"

import { describe, it } from "vitest"

import {
  decideListenAction,
  evaluateListenProgress,
  listenButtonState,
} from "@/store/listenRequest"
import type { UUID } from "@/uuid"

const A = "aaaaaaaa-0000-0000-0000-000000000000" as UUID
const B = "bbbbbbbb-0000-0000-0000-000000000000" as UUID
const trackOf = (uuid: UUID) =>
  `http://localhost/api/v2/books/${uuid}/listen/track1.mp3`

const base = {
  hasAudiobook: true,
  sessionBookUuid: null,
  sessionMode: "audiobook" as const,
  currentTrackUrl: null,
  bookUuid: A,
}

describe("decideListenAction", () => {
  it("refuses books without an audiobook", () => {
    assert.equal(
      decideListenAction({ ...base, hasAudiobook: false }),
      "unavailable",
    )
  })

  it("starts a book when nothing is loaded", () => {
    assert.equal(decideListenAction(base), "start")
  })

  it("switches when another book is loaded", () => {
    assert.equal(
      decideListenAction({
        ...base,
        sessionBookUuid: B,
        currentTrackUrl: trackOf(B),
      }),
      "start",
    )
  })

  it("only plays when the same audiobook is already loaded", () => {
    assert.equal(
      decideListenAction({
        ...base,
        sessionBookUuid: A,
        currentTrackUrl: trackOf(A),
      }),
      "play",
    )
  })

  it("restarts when the session is the same book in another mode", () => {
    assert.equal(
      decideListenAction({
        ...base,
        sessionBookUuid: A,
        sessionMode: "readaloud",
        currentTrackUrl: trackOf(A),
      }),
      "start",
    )
  })

  it("restarts when the session book has no track yet", () => {
    assert.equal(decideListenAction({ ...base, sessionBookUuid: A }), "start")
  })
})

describe("evaluateListenProgress", () => {
  const state = (
    error: string | null,
    url: string | null,
    errorMessage: string | null = null,
  ) => ({
    readingSession: { error, errorMessage },
    audioPlayer: { currentTrack: url ? { url } : null },
  })

  it("is pending while the old book's track is loaded", () => {
    assert.deepEqual(evaluateListenProgress(state(null, trackOf(B)), A), {
      status: "pending",
    })
  })

  it("is ready once a track of the book is loaded", () => {
    assert.deepEqual(evaluateListenProgress(state(null, trackOf(A)), A), {
      status: "ready",
    })
  })

  it("reports errors with their message", () => {
    assert.deepEqual(
      evaluateListenProgress(state("internal_error", null, "boom"), A),
      { status: "error", message: "boom" },
    )
  })
})

describe("listenButtonState", () => {
  const base = {
    sessionBookUuid: A,
    sessionMode: "audiobook" as const,
    hasTrack: true,
    playing: true,
    bookUuid: A,
  }
  it("is playing when this audiobook plays", () => {
    assert.strictEqual(listenButtonState(base), "playing")
  })
  it("is paused when loaded but not playing", () => {
    assert.strictEqual(listenButtonState({ ...base, playing: false }), "paused")
  })
  it("is idle for another book, another mode or no track", () => {
    assert.strictEqual(listenButtonState({ ...base, bookUuid: B }), "idle")
    assert.strictEqual(
      listenButtonState({ ...base, sessionMode: "epub" }),
      "idle",
    )
    assert.strictEqual(listenButtonState({ ...base, hasTrack: false }), "idle")
    assert.strictEqual(
      listenButtonState({ ...base, sessionBookUuid: null }),
      "idle",
    )
  })
})
