import assert from "node:assert"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import Db from "better-sqlite3"
import { describe, it } from "vitest"

import {
  type TestDbContext,
  seedBooks,
  seedSeries,
  seedUser,
  setupTestDb,
} from "@/__tests__/harness/testDb"
import { findExistingBook } from "@/assets/library/scanner/find-book"
import { type Candidate } from "@/assets/library/scanner/types"
import { runBookLinker } from "@/bookLinker"
import {
  countBooks,
  getBook,
  getBooks,
  setBooksArchived,
} from "@/database/books"
import { getLibraryCounts, getSectionFacets } from "@/database/libraryCounts"
import { getNextUpInSeries } from "@/database/nextUp"
import { getSeries } from "@/database/series"
import { type UUID } from "@/uuid"

const userId = "11111111-1111-1111-1111-111111111111" as UUID

const MIGRATION = readFileSync(
  join(process.cwd(), "migrations", "138_book_archive.sql"),
  "utf-8",
)

function titles(books: { title: string }[]) {
  return books.map((b) => b.title).sort()
}

function seedMixed(ctx: TestDbContext) {
  seedUser(ctx, userId)
  return seedBooks(ctx, [
    { title: "shown", ebook: "shown.epub" },
    { title: "hidden", ebook: "hidden.epub", archived: true },
    { title: "also shown", audiobook: "also" },
  ]) as [string, string, string]
}

describe("migration 138, archived_at", () => {
  it("adds a nullable column that defaults to null", () => {
    const sqlite = new Db(":memory:")
    sqlite.exec(`CREATE TABLE book (uuid TEXT PRIMARY KEY, title TEXT)`)
    sqlite.exec(MIGRATION)
    sqlite.prepare(`INSERT INTO book (uuid, title) VALUES ('a', 'x')`).run()
    const row = sqlite
      .prepare(`SELECT archived_at FROM book WHERE uuid = 'a'`)
      .get() as { archived_at: string | null }
    assert.strictEqual(row.archived_at, null)
    sqlite.close()
  })

  it("is part of schema.sql used by the tests", () => {
    using ctx = setupTestDb()
    const columns = ctx.sqlite.prepare(`PRAGMA table_info(book)`).all() as {
      name: string
    }[]
    assert.ok(columns.some((c) => c.name === "archived_at"))
  })
})

describe("listing and the archive", () => {
  it("excludes archived books by default, with and without a user", async () => {
    using ctx = setupTestDb()
    seedMixed(ctx)

    assert.deepStrictEqual(titles(await getBooks()), ["also shown", "shown"])
    assert.deepStrictEqual(titles(await getBooks(null, userId)), [
      "also shown",
      "shown",
    ])
    assert.strictEqual(await countBooks(userId), 2)
  })

  it("lists only or all archived state on request", async () => {
    using ctx = setupTestDb()
    seedMixed(ctx)

    assert.deepStrictEqual(
      titles(await getBooks(null, userId, { archived: "only" })),
      ["hidden"],
    )
    assert.deepStrictEqual(
      titles(await getBooks(null, userId, { archived: "all" })),
      ["also shown", "hidden", "shown"],
    )
    assert.deepStrictEqual(
      titles(await getBooks(null, undefined, { archived: "all" })),
      ["also shown", "hidden", "shown"],
    )
    assert.strictEqual(await countBooks(userId, { archived: "only" }), 1)
    assert.strictEqual(await countBooks(userId, { archived: "all" }), 3)
  })

  it("still finds an archived book by uuid, and carries archivedAt", async () => {
    using ctx = setupTestDb()
    const [shown, hidden] = seedMixed(ctx)

    const book = await getBook(hidden as UUID, userId)
    assert.ok(book)
    assert.ok(typeof book.archivedAt === "string")
    assert.strictEqual((await getBook(shown as UUID, userId))?.archivedAt, null)

    // uuids asked for explicitly can still be filtered out (sends do this)
    const sendable = await getBooks([shown, hidden] as UUID[], userId, {
      archived: "exclude",
    })
    assert.deepStrictEqual(titles(sendable), ["shown"])
  })

  it("sorts the archive by author key, series and title", async () => {
    using ctx = setupTestDb()
    seedUser(ctx, userId)
    const [b1, b2, b3, b4] = seedBooks(ctx, [
      { title: "Zed", archived: true },
      { title: "Beta", archived: true },
      { title: "Alpha", archived: true },
      { title: "Nobody", archived: true },
    ]) as [string, string, string, string]
    const author = (name: string, ...books: string[]) => {
      const uuid = crypto.randomUUID()
      ctx.sqlite
        .prepare(`INSERT INTO creator (uuid, name, file_as) VALUES (?, ?, ?)`)
        .run(uuid, name, name)
      for (const book of books) {
        ctx.sqlite
          .prepare(
            `INSERT INTO book_to_creator (book_uuid, creator_uuid, role) VALUES (?, ?, 'aut')`,
          )
          .run(book, uuid)
      }
    }
    author("J.R.R. Tolkien", b1, b2)
    author("Adams", b3)
    seedSeries(ctx, "Saga", [
      [b1, 1],
      [b2, 2],
    ])

    const sorted = await getBooks(null, userId, {
      archived: "only",
      orderBy: "authors",
      orderDirection: "asc",
    })
    assert.deepStrictEqual(
      sorted.map((b) => b.title),
      ["Alpha", "Zed", "Beta", "Nobody"],
    )
    const paged = await getBooks(null, userId, {
      archived: "only",
      orderBy: "authors",
      orderDirection: "asc",
      limit: 2,
      offset: 1,
    })
    assert.deepStrictEqual(
      paged.map((b) => b.title),
      ["Zed", "Beta"],
    )
  })
})

describe("counts, facets and next up", () => {
  it("counts exclude archived and report an archive count", async () => {
    using ctx = setupTestDb()
    seedMixed(ctx)

    const counts = await getLibraryCounts({ id: userId, permissions: null })
    assert.strictEqual(counts.books, 2)
    assert.strictEqual(counts.archive, 1)

    const facets = await getSectionFacets(
      { id: userId, permissions: null },
      "formats",
    )
    const byKey = Object.fromEntries(facets.map((f) => [f.key, f.bookCount]))
    assert.strictEqual(byKey["ebook"], 1)
    assert.strictEqual(byKey["audiobook"], 1)
  })

  it("a series with only archived books is not listed for a user", async () => {
    using ctx = setupTestDb()
    seedUser(ctx, userId)
    const [a, b] = seedBooks(ctx, [
      { title: "one", archived: true },
      { title: "two" },
    ]) as [string, string]
    seedSeries(ctx, "Only archived", [[a, 1]])
    seedSeries(ctx, "Visible", [[b, 1]])

    const series = await getSeries(userId)
    assert.deepStrictEqual(
      series.map((s) => s.name),
      ["Visible"],
    )
  })

  it("never suggests an archived book as next up", async () => {
    using ctx = setupTestDb()
    seedUser(ctx, userId)
    const [b1, b2, b3] = seedBooks(ctx, [
      { title: "one" },
      { title: "two", archived: true },
      { title: "three" },
    ]) as [string, string, string]
    seedSeries(ctx, "saga", [
      [b1, 1],
      [b2, 2],
      [b3, 3],
    ])
    const status = (book: string, name: string) =>
      ctx.sqlite
        .prepare(
          `INSERT INTO book_to_status (book_uuid, status_uuid, user_id)
           VALUES (?, (SELECT uuid FROM status WHERE name = ?), ?)`,
        )
        .run(book, name, userId)
    status(b1, "Read")
    status(b2, "To read")
    status(b3, "To read")

    const next = await getNextUpInSeries(userId)
    assert.deepStrictEqual(
      next.map((b) => b.title),
      ["three"],
    )
  })
})

describe("setBooksArchived", () => {
  it("sets and clears archived_at and bumps updated_at and the event log", async () => {
    using ctx = setupTestDb()
    const [shown] = seedMixed(ctx)

    // freeze updated_at in the past, bypassing the trigger that keeps it fresh
    const trigger = ctx.sqlite
      .prepare(
        `SELECT sql FROM sqlite_master WHERE name = 'book_event_update_trigger'`,
      )
      .get() as { sql: string }
    ctx.sqlite.exec(`DROP TRIGGER book_event_update_trigger`)
    ctx.sqlite
      .prepare(
        `UPDATE book SET updated_at = '2000-01-01 00:00:00' WHERE uuid = ?`,
      )
      .run(shown)
    ctx.sqlite.exec(trigger.sql)
    const eventsBefore = (
      ctx.sqlite
        .prepare(`SELECT count(*) AS n FROM event_log WHERE book_uuid = ?`)
        .get(shown) as { n: number }
    ).n

    const changed = await setBooksArchived([shown as UUID], true)
    assert.deepStrictEqual(changed, [shown])

    const row = ctx.sqlite
      .prepare(`SELECT archived_at, updated_at FROM book WHERE uuid = ?`)
      .get(shown) as { archived_at: string | null; updated_at: string }
    assert.ok(row.archived_at)
    assert.notStrictEqual(row.updated_at, "2000-01-01 00:00:00")
    const eventsAfter = (
      ctx.sqlite
        .prepare(`SELECT count(*) AS n FROM event_log WHERE book_uuid = ?`)
        .get(shown) as { n: number }
    ).n
    assert.ok(eventsAfter > eventsBefore)

    // archiving again changes nothing
    assert.deepStrictEqual(await setBooksArchived([shown as UUID], true), [])

    assert.deepStrictEqual(await setBooksArchived([shown as UUID], false), [
      shown,
    ])
    const cleared = ctx.sqlite
      .prepare(`SELECT archived_at FROM book WHERE uuid = ?`)
      .get(shown) as { archived_at: string | null }
    assert.strictEqual(cleared.archived_at, null)
  })
})

describe("internal operations still see archived books", () => {
  it("the scanner finds an archived book's file, so it is not re-imported", async () => {
    using ctx = setupTestDb()
    const [, hidden] = seedMixed(ctx)

    const candidate = {
      folder: "/library",
      format: "ebook",
      filepath: "hidden.epub",
    } as Candidate
    const found = await findExistingBook(candidate)
    assert.strictEqual(found?.uuid, hidden)

    const all = await getBooks(null, undefined, { archived: "all" })
    assert.strictEqual(all.length, 3)
  })

  it("the linker leaves archived books out of its pairing", async () => {
    using ctx = setupTestDb()
    seedUser(ctx, userId)
    const [ebook, audio] = seedBooks(ctx, [
      { title: "A Very Particular Title", ebook: "e.epub", archived: true },
      { title: "A Very Particular Title (Unabridged)", audiobook: "a" },
    ]) as [string, string]
    const creator = crypto.randomUUID()
    ctx.sqlite
      .prepare(
        `INSERT INTO creator (uuid, name, file_as) VALUES (?, 'Jane Doe', 'Doe, Jane')`,
      )
      .run(creator)
    for (const book of [ebook, audio]) {
      ctx.sqlite
        .prepare(
          `INSERT INTO book_to_creator (book_uuid, creator_uuid, role) VALUES (?, ?, 'aut')`,
        )
        .run(book, creator)
    }

    const result = await runBookLinker({ dryRun: true })
    assert.strictEqual(result.considered, 1)
    assert.strictEqual(result.pairs.length, 0)

    // once the ebook is back in the library the pair is found
    await setBooksArchived([ebook as UUID], false)
    const again = await runBookLinker({ dryRun: true })
    assert.strictEqual(again.pairs.length, 1)
  })
})

describe("duplicates against the database", () => {
  it("previews groups, archives only valid choices and skips archived books", async () => {
    const { archiveDuplicates, previewDuplicates } =
      await import("@/database/duplicates")
    using ctx = setupTestDb()
    seedUser(ctx, userId)
    const [a, b, c, other] = seedBooks(ctx, [
      { title: "Emma", ebook: "a.epub" },
      { title: "Emma [ill.]", ebook: "b.epub" },
      { title: "Emma (Unabridged)", ebook: "c.epub", archived: true },
      { title: "Persuasion", ebook: "d.epub" },
    ]) as [string, string, string, string]
    const creator = crypto.randomUUID()
    ctx.sqlite
      .prepare(
        `INSERT INTO creator (uuid, name, file_as) VALUES (?, 'Jane Austen', 'Austen, Jane')`,
      )
      .run(creator)
    for (const book of [a, b, c, other]) {
      ctx.sqlite
        .prepare(
          `INSERT INTO book_to_creator (book_uuid, creator_uuid, role) VALUES (?, ?, 'aut')`,
        )
        .run(book, creator)
    }
    ctx.sqlite
      .prepare(`UPDATE ebook SET file_size = 10 WHERE book_uuid = ?`)
      .run(a)
    ctx.sqlite
      .prepare(`UPDATE ebook SET file_size = 5 WHERE book_uuid = ?`)
      .run(b)

    const preview = await previewDuplicates()
    assert.strictEqual(preview.totalGroups, 1)
    assert.strictEqual(preview.booksToArchive, 1)
    assert.strictEqual(preview.groups[0]?.keeperUuid, a)

    const refused = await archiveDuplicates([
      { keeperUuid: a, archiveUuids: [other] },
    ])
    assert.strictEqual(refused.ok, false)
    assert.strictEqual((await getBook(other as UUID))?.archivedAt, null)

    const done = await archiveDuplicates([{ keeperUuid: a, archiveUuids: [b] }])
    assert.deepStrictEqual(done, { ok: true, archived: 1, groups: 1 })
    assert.ok((await getBook(b as UUID))?.archivedAt)
    assert.strictEqual((await getBook(a as UUID))?.archivedAt, null)
    assert.strictEqual((await previewDuplicates()).totalGroups, 0)
  })
})
