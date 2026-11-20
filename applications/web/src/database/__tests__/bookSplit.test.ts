import assert from "node:assert"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import Db from "better-sqlite3"
import { describe, it } from "vitest"

import {
  type TestDbContext,
  seedBooks,
  seedUser,
  setupTestDb,
} from "@/__tests__/harness/testDb"
import { findLinkPlan, runBookLinker } from "@/bookLinker"
import {
  addJoinExclusion,
  joinPairKey,
  loadJoinExclusions,
  removeJoinExclusion,
} from "@/database/bookJoinExclusions"
import { BookSplitError, splitAudiobookFromBook } from "@/database/bookSplit"
import { getBook, getBooks, updateBook } from "@/database/books"
import { ASSETS_DIR } from "@/directories"
import { type UUID } from "@/uuid"

const alice = "11111111-1111-1111-1111-111111111111" as UUID
const bob = "22222222-2222-2222-2222-222222222222" as UUID

const MIGRATION = readFileSync(
  join(process.cwd(), "migrations", "139_book_join_exclusion.sql"),
  "utf-8",
)

const TITLE = "The Long Road Home"

type Row = Record<string, unknown>

function all(ctx: TestDbContext, query: string, ...params: unknown[]) {
  return ctx.sqlite.prepare(query).all(...params) as Row[]
}

function seedMerged(
  ctx: TestDbContext,
  audiobookPath = "/nas/audio/long-road",
) {
  seedUser(ctx, alice)
  seedUser(ctx, bob)
  const [bookUuid] = seedBooks(ctx, [
    {
      title: TITLE,
      ebook: "/nas/books/long-road.epub",
      audiobook: audiobookPath,
    },
  ]) as [string]

  ctx.sqlite
    .prepare(
      `UPDATE book SET subtitle = 'A tale', description = 'Long', language = 'en',
        publication_date = '2001-01-01', release_date = '2020-02-02' WHERE uuid = ?`,
    )
    .run(bookUuid)

  const author = randomUUID()
  const narrator = randomUUID()
  ctx.sqlite
    .prepare(`INSERT INTO creator (uuid, name, file_as) VALUES (?, ?, ?)`)
    .run(author, "Ann Author", "Author, Ann")
  ctx.sqlite
    .prepare(`INSERT INTO creator (uuid, name, file_as) VALUES (?, ?, ?)`)
    .run(narrator, "Nick Narrator", "Narrator, Nick")
  const link = ctx.sqlite.prepare(
    `INSERT INTO book_to_creator (book_uuid, creator_uuid, role) VALUES (?, ?, ?)`,
  )
  link.run(bookUuid, author, "aut")
  link.run(bookUuid, narrator, "nrt")

  const series = randomUUID()
  ctx.sqlite
    .prepare(`INSERT INTO series (uuid, name) VALUES (?, 'Roads')`)
    .run(series)
  ctx.sqlite
    .prepare(
      `INSERT INTO book_to_series (series_uuid, book_uuid, position) VALUES (?, ?, 2.5)`,
    )
    .run(series, bookUuid)

  const tag = randomUUID()
  ctx.sqlite.prepare(`INSERT INTO tag (uuid, name) VALUES (?, 'epic')`).run(tag)
  ctx.sqlite
    .prepare(`INSERT INTO book_to_tag (book_uuid, tag_uuid) VALUES (?, ?)`)
    .run(bookUuid, tag)

  const collection = randomUUID()
  ctx.sqlite
    .prepare(`INSERT INTO collection (uuid, name, public) VALUES (?, 'Favourites', 1)`)
    .run(collection)
  ctx.sqlite
    .prepare(
      `INSERT INTO book_to_collection (book_uuid, collection_uuid) VALUES (?, ?)`,
    )
    .run(bookUuid, collection)

  // user data: bob is Reading and rated 4, alice has no rating
  const reading = ctx.sqlite
    .prepare(`SELECT uuid FROM status WHERE name = 'Reading'`)
    .get() as { uuid: string }
  const read = ctx.sqlite
    .prepare(`SELECT uuid FROM status WHERE name = 'Read'`)
    .get() as { uuid: string }
  const status = ctx.sqlite.prepare(
    `INSERT INTO book_to_status (book_uuid, status_uuid, user_id) VALUES (?, ?, ?)`,
  )
  status.run(bookUuid, reading.uuid, alice)
  status.run(bookUuid, read.uuid, bob)
  ctx.sqlite
    .prepare(
      `INSERT INTO user_book_rating (user_id, book_uuid, rating, review) VALUES (?, ?, 4, 'good')`,
    )
    .run(bob, bookUuid)

  // progress: both users have ebook and audiobook progress and history
  const progression = ctx.sqlite.prepare(
    `INSERT INTO progression (user_id, book_uuid, format, modified, device_id, device_name, progression)
     VALUES (?, ?, ?, '2024-01-01T00:00:00Z', 'd', 'dev', ?)`,
  )
  for (const user of [alice, bob]) {
    progression.run(user, bookUuid, "ebook", 0.1)
    progression.run(user, bookUuid, "audiobook", 0.7)
  }
  const history = ctx.sqlite.prepare(
    `INSERT INTO progression_history (user_id, book_uuid, source_format, modified, device_id, device_name, progression)
     VALUES (?, ?, ?, ?, 'd', 'dev', 0.5)`,
  )
  history.run(alice, bookUuid, "ebook", "2024-01-01T00:00:01Z")
  history.run(alice, bookUuid, "audiobook", "2024-01-01T00:00:02Z")
  ctx.sqlite
    .prepare(
      `INSERT INTO position (user_id, book_uuid, locator, timestamp) VALUES (?, ?, '{}', 1)`,
    )
    .run(alice, bookUuid)

  // identifiers: ISBN on the ebook, ASIN on the audiobook
  const ebookUuid = (
    ctx.sqlite
      .prepare(`SELECT uuid FROM ebook WHERE book_uuid = ?`)
      .get(bookUuid) as { uuid: string }
  ).uuid
  const audiobookUuid = (
    ctx.sqlite
      .prepare(`SELECT uuid FROM audiobook WHERE book_uuid = ?`)
      .get(bookUuid) as { uuid: string }
  ).uuid
  const isbnType = randomUUID()
  const asinType = randomUUID()
  ctx.sqlite
    .prepare(
      `INSERT INTO identifier_type (uuid, name, kind) VALUES (?, 'ISBN', 'isbn')`,
    )
    .run(isbnType)
  ctx.sqlite
    .prepare(
      `INSERT INTO identifier_type (uuid, name, kind) VALUES (?, 'ASIN', 'asin')`,
    )
    .run(asinType)
  const identifier = ctx.sqlite.prepare(
    `INSERT INTO identifier (book_uuid, identifier_type_uuid, value, ebook_uuid, audiobook_uuid)
     VALUES (?, ?, ?, ?, ?)`,
  )
  identifier.run(bookUuid, isbnType, "9780000000002", ebookUuid, null)
  identifier.run(bookUuid, asinType, "B000TEST01", null, audiobookUuid)
  // a book-level ASIN too
  identifier.run(bookUuid, asinType, "B000BOOK02", null, null)

  // import rule on the audiobook path
  ctx.sqlite
    .prepare(
      `INSERT INTO import_rule (kind, path, source, book_uuid) VALUES ('ignore', ?, 'import-relocate', ?)`,
    )
    .run(audiobookPath, bookUuid)

  return { bookUuid: bookUuid as UUID, ebookUuid, audiobookUuid }
}

describe("migration 139, book_join_exclusion", () => {
  it("keeps one row per pair in canonical order", () => {
    const sqlite = new Db(":memory:")
    sqlite.pragma("foreign_keys = ON")
    sqlite.exec(`CREATE TABLE book (uuid TEXT PRIMARY KEY)`)
    sqlite.exec(MIGRATION)
    sqlite.exec(`INSERT INTO book VALUES ('a'), ('b')`)
    sqlite
      .prepare(
        `INSERT INTO book_join_exclusion (book_a_uuid, book_b_uuid) VALUES ('a', 'b')`,
      )
      .run()
    assert.throws(() =>
      sqlite
        .prepare(
          `INSERT INTO book_join_exclusion (book_a_uuid, book_b_uuid) VALUES ('b', 'a')`,
        )
        .run(),
    )
    assert.throws(() =>
      sqlite
        .prepare(
          `INSERT INTO book_join_exclusion (book_a_uuid, book_b_uuid) VALUES ('a', 'b')`,
        )
        .run(),
    )
    sqlite.exec(`DELETE FROM book WHERE uuid = 'a'`)
    assert.strictEqual(
      sqlite.prepare(`SELECT count(*) AS n FROM book_join_exclusion`).get()
        ? (
            sqlite
              .prepare(`SELECT count(*) AS n FROM book_join_exclusion`)
              .get() as { n: number }
          ).n
        : -1,
      0,
    )
    sqlite.close()
  })
})

describe("splitAudiobookFromBook", () => {
  it("moves the audiobook and copies the relations", async () => {
    using ctx = setupTestDb()
    const { bookUuid, audiobookUuid, ebookUuid } = seedMerged(ctx)

    const created = await splitAudiobookFromBook(bookUuid, alice)

    assert.notStrictEqual(created.uuid, bookUuid)
    assert.strictEqual(created.title, TITLE)
    assert.strictEqual(created.subtitle, "A tale")
    assert.strictEqual(created.description, "Long")
    assert.strictEqual(created.language, "en")
    assert.strictEqual(
      created.publicationDate,
      (await getBook(bookUuid))?.publicationDate,
    )
    assert.strictEqual(
      created.releaseDate,
      (await getBook(bookUuid))?.releaseDate,
    )
    // stored exactly as on the original
    assert.deepStrictEqual(
      all(
        ctx,
        `SELECT publication_date, release_date FROM book WHERE uuid = ?`,
        created.uuid,
      ),
      [{ publication_date: "2001-01-01", release_date: "2020-02-02" }],
    )
    assert.strictEqual(created.audiobook?.uuid, audiobookUuid)
    assert.strictEqual(created.audiobook?.filepath, "/nas/audio/long-road")
    assert.strictEqual(created.ebook, null)
    assert.deepStrictEqual(
      created.authors.map((a) => a.name),
      ["Ann Author"],
    )
    assert.deepStrictEqual(
      created.narrators.map((a) => a.name),
      ["Nick Narrator"],
    )
    assert.deepStrictEqual(
      created.series.map((s) => [s.name, s.position]),
      [["Roads", 2.5]],
    )
    assert.deepStrictEqual(
      created.tags.map((t) => t.name),
      ["epic"],
    )
    assert.deepStrictEqual(
      created.collections.map((c) => c.name),
      ["Favourites"],
    )

    const kept = await getBook(bookUuid, alice)
    assert.ok(kept)
    assert.strictEqual(kept.ebook?.uuid, ebookUuid)
    assert.strictEqual(kept.ebook?.filepath, "/nas/books/long-road.epub")
    assert.strictEqual(kept.audiobook, null)
    assert.deepStrictEqual(
      kept.authors.map((a) => a.name),
      ["Ann Author"],
    )
    assert.deepStrictEqual(
      kept.series.map((s) => s.name),
      ["Roads"],
    )
    assert.notStrictEqual(created.assetDir, kept.assetDir)
    assert.strictEqual((await getBooks()).length, 2)
  })

  it("copies status and rating for every user", async () => {
    using ctx = setupTestDb()
    const { bookUuid } = seedMerged(ctx)

    const created = await splitAudiobookFromBook(bookUuid)

    const statusOf = (book: string) =>
      Object.fromEntries(
        all(
          ctx,
          `SELECT s.name AS status, b.user_id AS user FROM book_to_status b JOIN status s ON s.uuid = b.status_uuid WHERE b.book_uuid = ?`,
          book,
        ).map((r) => [r["user"], r["status"]]),
      )
    const expected = { [alice]: "Reading", [bob]: "Read" }
    assert.deepStrictEqual(statusOf(created.uuid), expected)
    assert.deepStrictEqual(statusOf(bookUuid), expected)

    const ratings = (book: string) =>
      all(
        ctx,
        `SELECT user_id, rating, review FROM user_book_rating WHERE book_uuid = ?`,
        book,
      )
    assert.deepStrictEqual(ratings(created.uuid), [
      { user_id: bob, rating: 4, review: "good" },
    ])
    assert.deepStrictEqual(ratings(bookUuid), [
      { user_id: bob, rating: 4, review: "good" },
    ])
  })

  it("moves audiobook progress and leaves ebook progress", async () => {
    using ctx = setupTestDb()
    const { bookUuid } = seedMerged(ctx)

    const created = await splitAudiobookFromBook(bookUuid)

    const progress = (book: string) =>
      all(
        ctx,
        `SELECT user_id, format, progression FROM progression WHERE book_uuid = ? ORDER BY user_id`,
        book,
      )
    assert.deepStrictEqual(progress(created.uuid), [
      { user_id: alice, format: "audiobook", progression: 0.7 },
      { user_id: bob, format: "audiobook", progression: 0.7 },
    ])
    assert.deepStrictEqual(progress(bookUuid), [
      { user_id: alice, format: "ebook", progression: 0.1 },
      { user_id: bob, format: "ebook", progression: 0.1 },
    ])

    const history = (book: string) =>
      all(
        ctx,
        `SELECT source_format FROM progression_history WHERE book_uuid = ?`,
        book,
      )
    assert.deepStrictEqual(history(created.uuid), [
      { source_format: "audiobook" },
    ])
    assert.deepStrictEqual(history(bookUuid), [{ source_format: "ebook" }])

    // the reading position is an ebook locator and stays
    assert.strictEqual(
      all(ctx, `SELECT 1 FROM position WHERE book_uuid = ?`, bookUuid).length,
      1,
    )
  })

  it("moves audiobook identifiers, copies ASINs, leaves ISBNs", async () => {
    using ctx = setupTestDb()
    const { bookUuid } = seedMerged(ctx)

    const created = await splitAudiobookFromBook(bookUuid)

    const values = (book: string) =>
      all(
        ctx,
        `SELECT value FROM identifier WHERE book_uuid = ? ORDER BY value`,
        book,
      ).map((r) => r["value"])
    assert.deepStrictEqual(values(created.uuid), ["B000BOOK02", "B000TEST01"])
    assert.deepStrictEqual(values(bookUuid), ["9780000000002", "B000BOOK02"])
  })

  it("moves the import rule of the audiobook path", async () => {
    using ctx = setupTestDb()
    const { bookUuid } = seedMerged(ctx)

    const created = await splitAudiobookFromBook(bookUuid)

    assert.deepStrictEqual(
      all(ctx, `SELECT book_uuid FROM import_rule`).map((r) => r["book_uuid"]),
      [created.uuid],
    )
  })

  it("records the pair so the linker skips it, also after a title change", async () => {
    using ctx = setupTestDb()
    const { bookUuid } = seedMerged(ctx)

    const created = await splitAudiobookFromBook(bookUuid)

    const rows = all(
      ctx,
      `SELECT book_a_uuid, book_b_uuid FROM book_join_exclusion`,
    )
    assert.strictEqual(rows.length, 1)
    assert.deepStrictEqual(
      [rows[0]?.["book_a_uuid"], rows[0]?.["book_b_uuid"]],
      [bookUuid, created.uuid].sort(),
    )
    const excluded = await loadJoinExclusions()
    assert.ok(excluded.has(joinPairKey(created.uuid, bookUuid)))

    // control: without the exclusion the two would be joined again
    const books = await getBooks()
    assert.strictEqual(findLinkPlan(books).pairs.length, 1)
    assert.strictEqual(findLinkPlan(books, excluded).pairs.length, 0)
    assert.strictEqual(findLinkPlan(books, excluded).ambiguous.length, 0)

    let dry = await runBookLinker({ dryRun: true })
    assert.strictEqual(dry.pairs.length, 0)

    // the exclusion is by book, not by title
    ctx.sqlite
      .prepare(`UPDATE book SET title = ? WHERE uuid = ?`)
      .run(`${TITLE} (Unabridged)`, created.uuid)
    dry = await runBookLinker({ dryRun: true })
    assert.strictEqual(dry.pairs.length, 0)
    const real = await runBookLinker()
    assert.strictEqual(real.pairs.length, 0)
    assert.strictEqual((await getBooks()).length, 2)

    // control: remove the exclusion and the linker proposes them again
    await removeJoinExclusion(ctx.db, bookUuid, created.uuid)
    dry = await runBookLinker({ dryRun: true })
    assert.strictEqual(dry.pairs.length, 1)
  })

  it("a manual merge of an excluded pair removes the exclusion", async () => {
    using ctx = setupTestDb()
    const { bookUuid } = seedMerged(ctx)
    const created = await splitAudiobookFromBook(bookUuid)

    // what the merge route does first
    await removeJoinExclusion(ctx.db, created.uuid, bookUuid)
    assert.strictEqual(all(ctx, `SELECT 1 FROM book_join_exclusion`).length, 0)

    // and the cascade covers the book that the merge deletes
    await addJoinExclusion(ctx.db, bookUuid, created.uuid)
    await updateBook(bookUuid, null, { books: [created.uuid] })
    assert.strictEqual(all(ctx, `SELECT 1 FROM book_join_exclusion`).length, 0)
    const merged = await getBook(bookUuid)
    assert.ok(merged?.ebook && merged.audiobook)
  })

  it("refuses a book with only one format", async () => {
    using ctx = setupTestDb()
    const [ebookOnly, audioOnly] = seedBooks(ctx, [
      { title: "E", ebook: "/x/e.epub" },
      { title: "A", audiobook: "/x/a" },
    ]) as [UUID, UUID]

    for (const uuid of [ebookOnly, audioOnly]) {
      await assert.rejects(
        splitAudiobookFromBook(uuid),
        (e) => e instanceof BookSplitError && e.status === 400,
      )
    }
    assert.strictEqual((await getBooks()).length, 2)
  })

  it("refuses a read-aloud book", async () => {
    using ctx = setupTestDb()
    const [uuid] = seedBooks(ctx, [
      {
        title: "R",
        ebook: "/x/e.epub",
        audiobook: "/x/a",
        readaloud: "/x/r.epub",
      },
    ]) as [UUID]

    await assert.rejects(
      splitAudiobookFromBook(uuid),
      (e) => e instanceof BookSplitError && e.status === 400,
    )
    assert.strictEqual((await getBooks()).length, 1)
  })

  it("refuses an unknown book", async () => {
    using _ctx = setupTestDb()
    await assert.rejects(
      splitAudiobookFromBook(randomUUID() as UUID),
      (e) => e instanceof BookSplitError && e.status === 404,
    )
  })

  it("refuses audiobooks inside the internal asset directory", async () => {
    using ctx = setupTestDb()
    const { bookUuid } = seedMerged(ctx, join(ASSETS_DIR, "Some Book", "audio"))

    await assert.rejects(
      splitAudiobookFromBook(bookUuid),
      (e) => e instanceof BookSplitError && e.status === 409,
    )
    assert.strictEqual((await getBooks()).length, 1)
    assert.strictEqual(all(ctx, `SELECT 1 FROM book_join_exclusion`).length, 0)
  })

  it("changes nothing when something fails part way", async () => {
    using ctx = setupTestDb()
    const { bookUuid, audiobookUuid } = seedMerged(ctx)
    // the last write of the split fails
    ctx.sqlite.exec(
      `CREATE TRIGGER fail_split BEFORE INSERT ON book_join_exclusion
       BEGIN SELECT RAISE(ABORT, 'forced failure'); END`,
    )

    const snapshot = () =>
      JSON.stringify(
        [
          "book",
          "audiobook",
          "book_to_creator",
          "book_to_series",
          "book_to_tag",
          "book_to_collection",
          "book_to_status",
          "user_book_rating",
          "identifier",
          "progression",
          "progression_history",
          "import_rule",
        ].map((table) => all(ctx, `SELECT * FROM ${table} ORDER BY 1`)),
      )
    const before = snapshot()

    await assert.rejects(splitAudiobookFromBook(bookUuid), /forced failure/)

    assert.strictEqual(snapshot(), before)
    const book = await getBook(bookUuid)
    assert.strictEqual(book?.audiobook?.uuid, audiobookUuid)
    assert.strictEqual((await getBooks()).length, 1)
  })
})
