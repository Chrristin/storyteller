import assert from "node:assert/strict"

import { test } from "vitest"

import {
  describeActionScope,
  describeKindleStop,
  describeSentAt,
  kindleBatches,
  kindleButtonLabel,
  kindleProgressLabel,
  kindleResendState,
  kindleErrorMessage,
  selectKindleBooks,
  splitByServers,
  summarizeKindleResults,
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

test("selectKindleBooks leaves out sent books unless resending", () => {
  const books = [{ uuid: "a" }, { uuid: "b" }, { uuid: "c" }]
  const sent = new Set(["a", "b"])
  assert.deepEqual(selectKindleBooks(books, sent, false), [{ uuid: "c" }])
  assert.equal(selectKindleBooks(books, sent, true).length, 3)
})

test("kindleResendState shows the checkbox only when some were sent", () => {
  const sent = new Set(["a", "b"])
  assert.deepEqual(kindleResendState(["c"], sent), {
    showCheckbox: false,
    defaultResend: false,
  })
  assert.deepEqual(kindleResendState(["a", "c"], sent), {
    showCheckbox: true,
    defaultResend: false,
  })
  assert.deepEqual(kindleResendState(["a", "b"], sent), {
    showCheckbox: true,
    defaultResend: true,
  })
  assert.deepEqual(kindleResendState([], sent), {
    showCheckbox: false,
    defaultResend: false,
  })
})

test("kindleButtonLabel and progress", () => {
  assert.equal(kindleButtonLabel(4, false).button, "Send 4 to Kindle")
  assert.equal(kindleButtonLabel(2, true).button, "Resend 2 to Kindle")
  assert.equal(kindleButtonLabel(2, true).action, "Resend")
  assert.equal(kindleProgressLabel(25, 60), "Sending 25 of 60")
})

test("summarizeKindleResults counts results and lists failures", () => {
  const titles = new Map([["x", "Dune"]])
  const out = summarizeKindleResults(
    [
      { uuid: "a", status: "sent" },
      { uuid: "b", status: "sent" },
      { uuid: "c", status: "skipped" },
      { uuid: "x", status: "failed", message: "Too big" },
      { uuid: "y", status: "failed" },
    ],
    titles,
  )
  assert.equal(
    out.summary,
    "2 sent, 1 skipped because it has no ebook, 2 failed",
  )
  assert.equal(
    out.message,
    "2 sent, 1 skipped because it has no ebook, 2 failed\n\nDune: Too big\nA book: Could not send this book",
  )
})

test("summarizeKindleResults falls back to old server counts", () => {
  assert.equal(
    summarizeKindleResults([], new Map(), { sent: 27, skipped: 3 }).message,
    "27 sent, 3 skipped because they have no ebook",
  )
  assert.equal(
    summarizeKindleResults([], new Map()).message,
    "Nothing was sent",
  )
})

test("describeActionScope handles Resend", () => {
  assert.equal(describeActionScope("Resend", 3, 0), "Resend 3 books?")
})
