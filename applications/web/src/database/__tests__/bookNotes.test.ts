import assert from "node:assert"
import { randomUUID } from "node:crypto"

import { describe, it } from "vitest"

import { seedBooks, setupTestDb } from "@/__tests__/harness/testDb"
import {
  createBookNote,
  deleteBookNote,
  listBookNotes,
  updateBookNote,
} from "@/database/bookNotes"
import { type UUID } from "@/uuid"

function addUser(
  ctx: ReturnType<typeof setupTestDb>,
  name: string | null,
  username: string | null,
): UUID {
  const permission = ctx.sqlite
    .prepare(`INSERT INTO user_permission DEFAULT VALUES RETURNING uuid`)
    .get() as { uuid: string }
  const user = ctx.sqlite
    .prepare(
      `INSERT INTO user (user_permission_uuid, email, name, username) VALUES (?, ?, ?, ?) RETURNING id`,
    )
    .get(permission.uuid, `${randomUUID()}@example.com`, name, username) as {
    id: string
  }
  return user.id as UUID
}

describe("book notes", () => {
  it("shows every user's notes on a book, with who wrote each", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "Christin", "christin")
    const preethi = addUser(ctx, null, "preethi")
    const [bookUuid] = seedBooks(ctx, [
      { title: "Dune", ebook: "dune.epub" },
    ]) as [UUID]

    await createBookNote(bookUuid, christin, "Slow start, great ending")
    await createBookNote(bookUuid, preethi, "Reading this next")

    const notes = await listBookNotes(bookUuid, preethi)
    assert.deepStrictEqual(
      notes.map((n) => [n.author, n.body, n.mine]),
      [
        ["Christin", "Slow start, great ending", false],
        ["preethi", "Reading this next", true],
      ],
    )
  })

  it("lets only the author change or delete a note", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "Christin", "christin")
    const preethi = addUser(ctx, "Preethi", "preethi")
    const [bookUuid] = seedBooks(ctx, [
      { title: "Dune", ebook: "dune.epub" },
    ]) as [UUID]
    const note = await createBookNote(bookUuid, christin, "mine")
    assert.ok(note)

    assert.strictEqual(
      await updateBookNote(note.uuid, preethi, "hijacked"),
      false,
    )
    assert.strictEqual(await deleteBookNote(note.uuid, preethi), false)
    assert.strictEqual((await listBookNotes(bookUuid))[0]?.body, "mine")

    assert.strictEqual(
      await updateBookNote(note.uuid, christin, "edited"),
      true,
    )
    assert.strictEqual((await listBookNotes(bookUuid))[0]?.body, "edited")
    assert.strictEqual(await deleteBookNote(note.uuid, christin), true)
    assert.strictEqual((await listBookNotes(bookUuid)).length, 0)
  })

  it("removes a book's notes with the book and a user's notes with the user", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "Christin", "christin")
    const [one, two] = seedBooks(ctx, [
      { title: "One", ebook: "one.epub" },
      { title: "Two", ebook: "two.epub" },
    ]) as [UUID, UUID]
    await createBookNote(one, christin, "a")
    await createBookNote(two, christin, "b")

    ctx.sqlite.prepare(`DELETE FROM book WHERE uuid = ?`).run(one)
    assert.strictEqual((await listBookNotes(one)).length, 0)
    assert.strictEqual((await listBookNotes(two)).length, 1)

    ctx.sqlite.prepare(`DELETE FROM user WHERE id = ?`).run(christin)
    assert.strictEqual((await listBookNotes(two)).length, 0)
  })
})
