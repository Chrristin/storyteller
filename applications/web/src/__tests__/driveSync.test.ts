import assert from "node:assert"

import { describe, it } from "vitest"

import {
  DRIVE_BATCH_SIZE,
  DRIVE_PREFERENCES_PATH,
  addBatchToTally,
  addFailedBatchToTally,
  chunk,
  driveRedirectUri,
  emptyTally,
  parseDriveResult,
} from "@/driveSync"
import { type UUID } from "@/uuid"

const id = (value: string) => value as UUID

describe("chunk", () => {
  it("splits 120 items into batches of 25", () => {
    const items = Array.from({ length: 120 }, (_, index) => index)
    const batches = chunk(items, DRIVE_BATCH_SIZE)
    assert.deepStrictEqual(
      batches.map((batch) => batch.length),
      [25, 25, 25, 25, 20],
    )
    assert.deepStrictEqual(batches.flat(), items)
  })

  it("returns no batches for no items", () => {
    assert.deepStrictEqual(chunk([], 25), [])
  })

  it("keeps an exact multiple in full batches", () => {
    assert.strictEqual(chunk(Array.from({ length: 50 }, String), 25).length, 2)
  })

  it("rejects a batch size below one", () => {
    assert.throws(() => chunk([1], 0), RangeError)
    assert.throws(() => chunk([1], 1.5), RangeError)
  })
})

describe("tally", () => {
  it("adds batches and collects failures", () => {
    let tally = emptyTally()
    tally = addBatchToTally(tally, {
      sent: 1,
      replaced: 0,
      skipped: 1,
      failed: 1,
      results: [
        { uuid: id("a"), title: "A", status: "sent" },
        { uuid: id("b"), title: "B", status: "skipped" },
        { uuid: id("c"), title: "C", status: "failed", message: "boom" },
      ],
    })
    tally = addBatchToTally(tally, {
      sent: 0,
      replaced: 1,
      skipped: 0,
      failed: 0,
      results: [{ uuid: id("d"), title: "D", status: "replaced" }],
    })
    assert.deepStrictEqual(tally, {
      sent: 1,
      replaced: 1,
      skipped: 1,
      failed: 1,
      failures: [{ uuid: id("c"), title: "C", message: "boom" }],
    })
  })

  it("counts a whole batch as failed when the request fails", () => {
    const tally = addFailedBatchToTally(
      emptyTally(),
      [
        { uuid: id("a"), title: "A" },
        { uuid: id("b"), title: "B" },
      ],
      "Drive is unreachable",
    )
    assert.strictEqual(tally.failed, 2)
    assert.strictEqual(tally.failures[1]?.message, "Drive is unreachable")
  })
})

describe("parseDriveResult", () => {
  it("accepts the known results only", () => {
    assert.strictEqual(parseDriveResult("connected"), "connected")
    assert.strictEqual(parseDriveResult("no-refresh-token"), "no-refresh-token")
    assert.strictEqual(parseDriveResult("nope"), null)
    assert.strictEqual(parseDriveResult(null), null)
  })
})

describe("driveRedirectUri", () => {
  it("builds the callback address from the origin", () => {
    assert.strictEqual(
      driveRedirectUri("https://books.example.com"),
      "https://books.example.com/api/v2/drive/callback",
    )
    assert.strictEqual(
      driveRedirectUri("http://localhost:8001/"),
      "http://localhost:8001/api/v2/drive/callback",
    )
  })
})

describe("DRIVE_PREFERENCES_PATH", () => {
  it("points at the Google Drive section of the Devices tab", () => {
    const url = new URL(DRIVE_PREFERENCES_PATH, "http://localhost")
    assert.strictEqual(url.pathname, "/preferences")
    assert.strictEqual(url.searchParams.get("tab"), "devices")
    assert.strictEqual(url.searchParams.get("section"), "googleDrive")
  })

  it("matches the address the server sends users back to after Google", () => {
    assert.strictEqual(
      driveRedirectUri("https://books.example.com/"),
      "https://books.example.com/api/v2/drive/callback",
    )
  })
})
