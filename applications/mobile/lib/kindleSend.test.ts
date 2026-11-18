import assert from "node:assert/strict"

import { test } from "vitest"

import {
  describeActionScope,
  describeKindleStop,
  describeSentAt,
  kindleBatches,
  kindleButtonLabel,
  kindleErrorMessage,
  splitByServers,
  summarizeKindleSend,
} from "./kindleSend"

test("kindleBatches groups into at most 25", () => {
  const ids = Array.from({ length: 51 }, (_, i) => i)
  assert.deepEqual(
    kindleBatches(ids).map((b) => b.length),
    [25, 25, 1],
  )
  assert.deepEqual(kindleBatches([]), [])
})

test("kindleErrorMessage maps known codes", () => {
  assert.equal(
    kindleErrorMessage({ data: { code: "too-large", message: "x" } }),
    "These books are too big to send in one email. Select fewer.",
  )
  assert.equal(
    kindleErrorMessage({ data: { code: "no-kindle-address" } }),
    "No Kindle address saved. Add one in Preferences on the web.",
  )
  assert.equal(
    kindleErrorMessage({ data: { code: "smtp-not-configured" } }),
    "The server cannot send email yet.",
  )
})

test("kindleErrorMessage falls back to the server message", () => {
  assert.equal(
    kindleErrorMessage({ data: { code: "send-failed", message: "Bad SMTP" } }),
    "Bad SMTP",
  )
  assert.equal(
    kindleErrorMessage({ status: "FETCH_ERROR" }),
    "Could not reach the server",
  )
  assert.equal(
    kindleErrorMessage(null),
    "Something went wrong while sending to your Kindle",
  )
})

test("summarizeKindleSend uses plain English", () => {
  assert.equal(summarizeKindleSend(5, 0), "5 books sent to your Kindle")
  assert.equal(summarizeKindleSend(1, 0), "1 book sent to your Kindle")
  assert.equal(
    summarizeKindleSend(2, 1),
    "2 books sent to your Kindle, 1 book skipped because it has no ebook",
  )
  assert.equal(summarizeKindleSend(0, 0), "Nothing was sent")
})

test("describeKindleStop reports what was sent before the error", () => {
  assert.equal(
    describeKindleStop(25, 0, {
      data: { code: "send-failed", message: "Boom" },
    }),
    "25 books sent to your Kindle before it stopped. Boom",
  )
  assert.equal(
    describeKindleStop(0, 0, { data: { code: "too-large" } }),
    "These books are too big to send in one email. Select fewer.",
  )
})

test("splitByServers keeps only books on available servers", () => {
  const books = [
    { id: 1, serverUuid: "a" },
    { id: 2, serverUuid: "b" },
    { id: 3, serverUuid: "a" },
  ]
  const { included, excluded } = splitByServers(books, new Set(["a"]))
  assert.deepEqual(
    included.map((b) => b.id),
    [1, 3],
  )
  assert.deepEqual(
    excluded.map((b) => b.id),
    [2],
  )
})

test("describeActionScope names books that are left out", () => {
  assert.equal(describeActionScope("Send", 3, 0), "Send 3 books?")
  assert.equal(
    describeActionScope("Send", 1, 2),
    "Send 1 book? 2 selected books are on a server where this is not available and will be left out.",
  )
})

test("describeSentAt shows how long ago", () => {
  const now = Date.parse("2026-01-10T12:00:00Z")
  assert.equal(describeSentAt("2026-01-10T11:59:40Z", now), "Sent just now")
  assert.equal(
    describeSentAt("2026-01-10T11:55:00Z", now),
    "Sent 5 minutes ago",
  )
  assert.equal(describeSentAt("2026-01-07T12:00:00Z", now), "Sent 3 days ago")
  assert.equal(describeSentAt("2026-01-09T12:00:00Z", now), "Sent 1 day ago")
  assert.equal(describeSentAt("nonsense", now), "Sent")
  assert.equal(describeSentAt(null, now), "Sent")
})

test("kindleButtonLabel says Resend only when all were sent", () => {
  const sent = new Set(["a", "b"])
  assert.equal(kindleButtonLabel(["a", "b"], sent).button, "Resend 2 to Kindle")
  assert.equal(kindleButtonLabel(["a", "b"], sent).action, "Resend")
  assert.equal(kindleButtonLabel(["a"], sent).button, "Resend 1 to Kindle")
  assert.equal(kindleButtonLabel(["a", "c"], sent).button, "Send 2 to Kindle")
  assert.equal(kindleButtonLabel(["c"], sent).action, "Send")
  assert.equal(kindleButtonLabel([], sent).button, "Send 0 to Kindle")
  assert.equal(kindleButtonLabel(["a", "c"], sent).busy, "Sending 2 books...")
  assert.equal(kindleButtonLabel(["a"], sent).busy, "Sending 1 book...")
})

test("describeActionScope handles Resend", () => {
  assert.equal(describeActionScope("Resend", 3, 0), "Resend 3 books?")
})
