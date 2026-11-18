import assert from "node:assert"
import { randomUUID } from "node:crypto"

import { describe, it } from "vitest"

import { seedBooks, setupTestDb } from "@/__tests__/harness/testDb"
import { getKindleSends, recordKindleSends } from "@/database/kindleSends"
import { type UUID } from "@/uuid"

function addUser(ctx: ReturnType<typeof setupTestDb>, username: string): UUID {
  const permission = ctx.sqlite
    .prepare(`INSERT INTO user_permission DEFAULT VALUES RETURNING uuid`)
    .get() as { uuid: string }
  const user = ctx.sqlite
    .prepare(
      `INSERT INTO user (user_permission_uuid, email, name, username) VALUES (?, ?, ?, ?) RETURNING id`,
    )
    .get(
      permission.uuid,
      `${randomUUID()}@example.com`,
      username,
      username,
    ) as { id: string }
  return user.id as UUID
}

describe("kindle sends", () => {
  it("remembers sends per user, updates the time and cascades", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "christin")
    const wife = addUser(ctx, "wife")
    const [dune, emma] = seedBooks(ctx, [
      { title: "Dune", ebook: "dune.epub" },
      { title: "Emma", ebook: "emma.epub" },
    ]) as [UUID, UUID]

    await recordKindleSends(christin, [dune, emma], "a@kindle.com")
    const first = await getKindleSends(christin, [dune, emma])
    assert.strictEqual(first.size, 2)
    assert.strictEqual(first.get(dune)?.address, "a@kindle.com")

    // Another user never sent them.
    assert.strictEqual((await getKindleSends(wife, [dune, emma])).size, 0)

    ctx.sqlite
      .prepare(
        `UPDATE book_kindle_send SET sent_at = '2000-01-01T00:00:00.000Z'`,
      )
      .run()
    await recordKindleSends(christin, [dune], "b@kindle.com")
    const again = await getKindleSends(christin, [dune, emma])
    assert.strictEqual(again.get(dune)?.address, "b@kindle.com")
    assert.notStrictEqual(again.get(dune)?.sentAt, "2000-01-01T00:00:00.000Z")
    assert.strictEqual(again.get(emma)?.sentAt, "2000-01-01T00:00:00.000Z")

    ctx.sqlite.prepare(`DELETE FROM book WHERE uuid = ?`).run(dune)
    const left = await getKindleSends(christin, [dune, emma])
    assert.strictEqual(left.size, 1)
    assert.ok(left.has(emma))
  })
})
