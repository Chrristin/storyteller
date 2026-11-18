import assert from "node:assert"

import { describe, it } from "vitest"

import { emptyTally } from "@/driveSync"
import {
  addKindleBatchToTally,
  allKindleSent,
  selectKindleTargets,
} from "@/kindleBulk"
import { type UUID } from "@/uuid"

const id = (value: string) => value as UUID
const books = ["a", "b", "c"].map((u) => ({
  uuid: id(u),
  title: u.toUpperCase(),
}))
const sent = { b: { sentAt: "2026-01-01T00:00:00Z", address: null } }

describe("selectKindleTargets", () => {
  it("leaves out sent books and counts them", () => {
    const { targets, leftOut } = selectKindleTargets(books, sent, false)
    assert.deepStrictEqual(
      targets.map((book) => book.uuid),
      ["a", "c"],
    )
    assert.strictEqual(leftOut, 1)
  })

  it("keeps everything when resending", () => {
    const { targets, leftOut } = selectKindleTargets(books, sent, true)
    assert.strictEqual(targets.length, 3)
    assert.strictEqual(leftOut, 0)
  })

  it("keeps everything while sent records are unknown", () => {
    assert.strictEqual(
      selectKindleTargets(books, undefined, false).targets.length,
      3,
    )
  })
})

describe("allKindleSent", () => {
  it("is true only when every book has a record", () => {
    assert.strictEqual(allKindleSent(books, sent), false)
    const all = Object.fromEntries(
      books.map((book) => [book.uuid, { sentAt: "x", address: null }]),
    )
    assert.strictEqual(allKindleSent(books, all), true)
    assert.strictEqual(allKindleSent([], all), false)
    assert.strictEqual(allKindleSent(books, undefined), false)
  })
})

describe("addKindleBatchToTally", () => {
  it("counts results and keeps failures with titles", () => {
    const tally = addKindleBatchToTally(
      emptyTally(),
      {
        sent: 1,
        skipped: 1,
        emails: 1,
        results: [
          { uuid: "a", status: "sent" },
          { uuid: "b", status: "skipped" },
          { uuid: "c", status: "failed", message: "Nope" },
        ],
      },
      books,
    )
    assert.strictEqual(tally.sent, 1)
    assert.strictEqual(tally.skipped, 1)
    assert.strictEqual(tally.failed, 1)
    assert.deepStrictEqual(tally.failures, [
      { uuid: "c", title: "C", message: "Nope" },
    ])
  })
})
