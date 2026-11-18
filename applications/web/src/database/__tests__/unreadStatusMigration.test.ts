import assert from "node:assert"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, it } from "vitest"

import {
  seedBooks,
  seedUser,
  setupTestDb,
  type TestDbContext,
} from "@/__tests__/harness/testDb"
import { getDefaultStatus, getStatuses } from "@/database/statuses"
import { type UUID } from "@/uuid"

const MIGRATION = readFileSync(
  join(process.cwd(), "migrations", "134_unread_status.sql"),
  "utf-8",
)

const userA = "11111111-1111-1111-1111-111111111111" as UUID
const userB = "22222222-2222-2222-2222-222222222222" as UUID

// The state before the migration: the three seeded statuses, "To read" default.
function resetToOldStatuses(ctx: TestDbContext) {
  ctx.sqlite.exec(`DELETE FROM status`)
  ctx.sqlite.exec(`
    INSERT INTO status (name, label, is_default) VALUES
      ('To read', 'To read', 1),
      ('Reading', 'Reading', 0),
      ('Read', 'Read', 0)
  `)
}

function setStatus(
  ctx: TestDbContext,
  bookUuid: string,
  userId: string,
  name: string,
) {
  ctx.sqlite
    .prepare(
      `INSERT INTO book_to_status (book_uuid, status_uuid, user_id)
       VALUES (?, (SELECT uuid FROM status WHERE name = ?), ?)`,
    )
    .run(bookUuid, name, userId)
}

function statusOf(ctx: TestDbContext, bookUuid: string, userId: string) {
  const row = ctx.sqlite
    .prepare(
      `SELECT status.name AS name FROM book_to_status
       INNER JOIN status ON status.uuid = book_to_status.status_uuid
       WHERE book_uuid = ? AND user_id = ?`,
    )
    .get(bookUuid, userId) as { name: string } | undefined
  return row?.name
}

describe("134_unread_status", () => {
  it("is the default for new books in a fresh test database", async () => {
    using ctx = setupTestDb()
    void ctx
    assert.strictEqual((await getDefaultStatus())?.name, "Unread")
    assert.deepStrictEqual(
      (await getStatuses()).map((s) => s.name),
      ["Unread", "To read", "Reading", "Read"],
    )
  })

  it("adds Unread, makes it the default and converts every To read row", () => {
    using ctx = setupTestDb()
    seedUser(ctx, userA)
    seedUser(ctx, userB)
    resetToOldStatuses(ctx)

    const [b1, b2, b3] = seedBooks(ctx, [
      { title: "one" },
      { title: "two" },
      { title: "three" },
    ]) as [string, string, string]
    setStatus(ctx, b1, userA, "To read")
    setStatus(ctx, b1, userB, "To read")
    setStatus(ctx, b2, userA, "Reading")
    setStatus(ctx, b3, userA, "Read")

    ctx.sqlite.exec(MIGRATION)

    assert.strictEqual(statusOf(ctx, b1, userA), "Unread")
    assert.strictEqual(statusOf(ctx, b1, userB), "Unread")
    assert.strictEqual(statusOf(ctx, b2, userA), "Reading")
    assert.strictEqual(statusOf(ctx, b3, userA), "Read")

    const rows = ctx.sqlite
      .prepare(`SELECT name, label, is_default FROM status ORDER BY name`)
      .all() as { name: string; label: string; is_default: number }[]
    assert.deepStrictEqual(
      rows.map((r) => [r.name, r.is_default]),
      [
        ["Read", 0],
        ["Reading", 0],
        ["To read", 0],
        ["Unread", 1],
      ],
    )
    assert.strictEqual(rows.find((r) => r.name === "Unread")?.label, "Unread")
  })

  it("skips the conversion when there is no To read status", () => {
    using ctx = setupTestDb()
    seedUser(ctx, userA)
    ctx.sqlite.exec(`DELETE FROM status`)
    ctx.sqlite.exec(`
      INSERT INTO status (name, label, is_default) VALUES
        ('Backlog', 'Backlog', 1),
        ('Reading', 'Reading', 0)
    `)
    const [b1] = seedBooks(ctx, [{ title: "one" }]) as [string]
    setStatus(ctx, b1, userA, "Backlog")

    ctx.sqlite.exec(MIGRATION)

    assert.strictEqual(statusOf(ctx, b1, userA), "Backlog")
    const unread = ctx.sqlite
      .prepare(`SELECT is_default FROM status WHERE name = 'Unread'`)
      .get() as { is_default: number }
    assert.strictEqual(unread.is_default, 1)
  })

  it("does not add a second Unread when one already exists", () => {
    using ctx = setupTestDb()
    ctx.sqlite.exec(MIGRATION)
    const count = ctx.sqlite
      .prepare(`SELECT count(*) AS n FROM status WHERE name = 'Unread'`)
      .get() as { n: number }
    assert.strictEqual(count.n, 1)
  })
})
