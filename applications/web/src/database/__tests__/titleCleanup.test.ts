import { mkdir, rm } from "node:fs/promises"

import { describe, expect, it, vi } from "vitest"

import {
  type TestDbContext,
  seedBooks,
  setupTestDb,
} from "@/__tests__/harness/testDb"
import { getInternalBookDirectory } from "@/assets/paths"
import { getBook } from "@/database/books"
import { saveIdentity } from "@/database/hardcoverIdentity"
import {
  applyTitleCleanup,
  getLastTitleCleanupBatch,
  previewTitleCleanup,
  undoTitleCleanup,
} from "@/database/titleCleanup"
import { ASSETS_DIR } from "@/directories"
import { type UUID } from "@/uuid"

const queueWritesToFiles = vi.fn(async (_uuid: string) => {})
vi.mock("@/writeToFiles/fileWriteDistributor", () => ({
  queueWritesToFiles: (uuid: string) => queueWritesToFiles(uuid),
}))

function addAuthor(ctx: TestDbContext, bookUuid: string, name: string) {
  const existing = ctx.sqlite
    .prepare(`SELECT uuid FROM creator WHERE name = ?`)
    .get(name) as { uuid: string } | undefined
  const uuid =
    existing?.uuid ??
    (
      ctx.sqlite
        .prepare(
          `INSERT INTO creator (name, file_as) VALUES (?, ?) RETURNING uuid`,
        )
        .get(name, name) as { uuid: string }
    ).uuid
  ctx.sqlite
    .prepare(
      `INSERT INTO book_to_creator (book_uuid, creator_uuid, role) VALUES (?, ?, 'aut')`,
    )
    .run(bookUuid, uuid)
}

function titleOf(ctx: TestDbContext, uuid: string) {
  return (
    ctx.sqlite.prepare(`SELECT title FROM book WHERE uuid = ?`).get(uuid) as {
      title: string
    }
  ).title
}

async function seed(ctx: TestDbContext, makeDirs = true) {
  await rm(ASSETS_DIR, { recursive: true, force: true })
  await mkdir(ASSETS_DIR, { recursive: true })
  const [eye, dune, hobbit, other] = seedBooks(ctx, [
    { title: "01 Eye of the World", audiobook: "/a/eye" },
    { title: "Dune (Unabridged)", audiobook: "/a/dune" },
    { title: "The Hobbit", ebook: "/e/hobbit.epub" },
    { title: "Plain Title", ebook: "/e/plain.epub" },
  ]) as [UUID, UUID, UUID, UUID]
  for (const uuid of [eye, dune, hobbit, other]) {
    addAuthor(ctx, uuid, "Someone")
    const book = await getBook(uuid)
    // A real book has its asset folder; a title edit moves it.
    if (book && makeDirs) {
      await mkdir(getInternalBookDirectory(book), { recursive: true })
    }
  }
  return { eye, dune, hobbit, other }
}

describe("title clean-up", () => {
  it("previews with the Hardcover title and a sibling as known titles", async () => {
    using ctx = setupTestDb()
    const { eye, dune, other } = await seed(ctx)
    await saveIdentity(eye, {
      status: "sure",
      matchedTitle: "The Eye of the World",
    })
    // A check row is not trusted.
    await saveIdentity(dune, { status: "check", matchedTitle: "The Dune" })
    // An ebook of the same title is the sibling of the audiobook.
    const [duneEbook] = seedBooks(ctx, [
      { title: "The Dune", ebook: "/e/dune.epub" },
    ]) as [UUID]
    addAuthor(ctx, duneEbook, "Someone")

    const items = await previewTitleCleanup()
    const byUuid = new Map(items.map((i) => [i.bookUuid, i]))
    expect(byUuid.get(eye)?.newTitle).toBe("The Eye of the World")
    // "Dune" and "The Dune" are the same title once the article is dropped.
    expect(byUuid.get(dune)?.newTitle).toBe("The Dune")
    expect(byUuid.has(other)).toBe(false)
    expect(items).toHaveLength(2)
  })

  it("applies in batches, logs old titles and undoes", async () => {
    using ctx = setupTestDb()
    const { eye, dune } = await seed(ctx)
    queueWritesToFiles.mockClear()

    const result = await applyTitleCleanup()
    expect(result.applied).toBe(2)
    expect(result.errors).toEqual([])
    expect(titleOf(ctx, eye)).toBe("Eye of the World")
    expect(titleOf(ctx, dune)).toBe("Dune")
    expect(queueWritesToFiles).toHaveBeenCalledTimes(2)

    const log = ctx.sqlite
      .prepare(
        `SELECT old_title, new_title, batch_id FROM title_cleanup_log ORDER BY old_title`,
      )
      .all() as { old_title: string; new_title: string; batch_id: string }[]
    expect(log.map((r) => [r.old_title, r.new_title])).toEqual([
      ["01 Eye of the World", "Eye of the World"],
      ["Dune (Unabridged)", "Dune"],
    ])
    expect(new Set(log.map((r) => r.batch_id)).size).toBe(1)
    expect((await getLastTitleCleanupBatch())?.count).toBe(2)

    // Applying again finds nothing.
    expect((await applyTitleCleanup()).applied).toBe(0)

    // A title edited since is left alone by the undo.
    ctx.sqlite
      .prepare(`UPDATE book SET title = 'My Dune' WHERE uuid = ?`)
      .run(dune)
    const undone = await undoTitleCleanup()
    expect(undone.restored).toBe(1)
    expect(undone.skipped).toBe(1)
    expect(titleOf(ctx, eye)).toBe("01 Eye of the World")
    expect(titleOf(ctx, dune)).toBe("My Dune")
    expect(await getLastTitleCleanupBatch()).toBeNull()
  })

  it("applies only the given books", async () => {
    using ctx = setupTestDb()
    const { eye, dune } = await seed(ctx)
    const result = await applyTitleCleanup([eye])
    expect(result.applied).toBe(1)
    expect(titleOf(ctx, eye)).toBe("Eye of the World")
    expect(titleOf(ctx, dune)).toBe("Dune (Unabridged)")
  })

  it("keeps the log row when only the asset folder move fails", async () => {
    using ctx = setupTestDb()
    const { eye } = await seed(ctx, false)
    const result = await applyTitleCleanup([eye])
    expect(result.applied).toBe(1)
    expect(result.errors[0]?.message).toContain("Title saved")
    expect(titleOf(ctx, eye)).toBe("Eye of the World")
    expect((await undoTitleCleanup()).restored).toBe(1)
  })

  it("collects an error for one book and keeps going", async () => {
    using ctx = setupTestDb()
    const { eye, dune } = await seed(ctx)
    const books = await import("@/database/books")
    const original = books.updateBook
    const spy = vi
      .spyOn(books, "updateBook")
      .mockImplementation(async (uuid, ...rest) => {
        if (uuid === eye) throw new Error("boom")
        return await original(uuid, ...rest)
      })
    try {
      const result = await applyTitleCleanup()
      expect(result.applied).toBe(1)
      expect(result.errors).toEqual([{ bookUuid: eye, message: "boom" }])
      expect(titleOf(ctx, dune)).toBe("Dune")
      const log = ctx.sqlite
        .prepare(`SELECT book_uuid FROM title_cleanup_log`)
        .all()
      expect(log).toHaveLength(1)
    } finally {
      spy.mockRestore()
    }
  })
})
