import assert from "node:assert/strict"

import { test } from "vitest"

import {
  chunkBooks,
  describeSyncedAt,
  driveErrorMessage,
  summarizeDriveResults,
} from "./driveSync"

test("chunkBooks groups a selection into batches of 25", () => {
  const ids = Array.from({ length: 60 }, (_, i) => `b${i}`)
  const batches = chunkBooks(ids)
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [25, 25, 10],
  )
  assert.deepEqual(batches.flat(), ids)
})

test("chunkBooks handles empty and exact selections", () => {
  assert.deepEqual(chunkBooks([]), [])
  assert.equal(chunkBooks(Array(25).fill("a")).length, 1)
})

test("summarizeDriveResults describes sent and skipped books", () => {
  const { message } = summarizeDriveResults([
    { uuid: "1", title: "A", status: "sent" },
    { uuid: "2", title: "B", status: "sent" },
    { uuid: "3", title: "C", status: "skipped" },
  ])
  assert.equal(message, "2 sent, 1 skipped because it was already in Drive")
})

test("summarizeDriveResults lists failures with the server message", () => {
  const { message, failures } = summarizeDriveResults([
    { uuid: "1", title: "A", status: "replaced" },
    { uuid: "2", title: "B", status: "skipped" },
    { uuid: "3", title: "C", status: "skipped" },
    { uuid: "4", title: "D", status: "failed", message: "No ebook" },
  ])
  assert.deepEqual(failures, ["D: No ebook"])
  assert.equal(
    message,
    "1 replaced, 2 skipped because they were already in Drive, 1 failed\n\nD: No ebook",
  )
})

test("summarizeDriveResults handles no results", () => {
  assert.equal(summarizeDriveResults([]).message, "Nothing was sent")
})

test("driveErrorMessage prefers the server message", () => {
  assert.equal(
    driveErrorMessage({
      status: 409,
      data: { code: "x", message: "Sign in again" },
    }),
    "Sign in again",
  )
  assert.equal(
    driveErrorMessage({ status: "FETCH_ERROR" }),
    "Could not reach the server",
  )
  assert.equal(driveErrorMessage(new Error("boom")), "boom")
})

test("describeSyncedAt", () => {
  const now = Date.parse("2026-01-10T12:00:00Z")
  assert.equal(describeSyncedAt("2026-01-10T11:59:30Z", now), "Copied just now")
  assert.equal(
    describeSyncedAt("2026-01-10T11:55:00Z", now),
    "Copied 5 minutes ago",
  )
  assert.equal(
    describeSyncedAt("2026-01-10T09:00:00Z", now),
    "Copied 3 hours ago",
  )
  assert.equal(
    describeSyncedAt("2026-01-08T12:00:00Z", now),
    "Copied 2 days ago",
  )
  assert.equal(describeSyncedAt(null, now), "On Drive")
})
