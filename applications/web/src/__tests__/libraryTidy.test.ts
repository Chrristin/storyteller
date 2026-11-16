import assert from "node:assert"

import { describe, it } from "vitest"

import {
  type TidyEntity,
  chooseCanonical,
  groupDuplicates,
  normaliseAuthorName,
  normaliseSeriesName,
} from "@/libraryTidy"

const e = (name: string, books = 1, uuid = name): TidyEntity => ({
  uuid: uuid as TidyEntity["uuid"],
  name,
  books,
})

describe("normaliseAuthorName", () => {
  it("collapses initials spacing and punctuation", () => {
    const a = normaliseAuthorName("J. R. R. Tolkien")
    assert.strictEqual(a, normaliseAuthorName("J.R.R. Tolkien"))
    assert.strictEqual(a, normaliseAuthorName("JRR Tolkien"))
    assert.strictEqual(a, normaliseAuthorName("j r r tolkien"))
  })

  it("ignores diacritics and case", () => {
    assert.strictEqual(
      normaliseAuthorName("Gabriel García Márquez"),
      normaliseAuthorName("GABRIEL GARCIA MARQUEZ"),
    )
  })

  it("does not merge different names", () => {
    assert.notStrictEqual(
      normaliseAuthorName("John Smith"),
      normaliseAuthorName("Jon Smith"),
    )
    assert.notStrictEqual(
      normaliseAuthorName("J. K. Rowling"),
      normaliseAuthorName("J. Rowling"),
    )
  })
})

describe("normaliseSeriesName", () => {
  it("drops a leading The and a trailing series word", () => {
    const k = normaliseSeriesName("Lord of the Rings")
    assert.strictEqual(normaliseSeriesName("The Lord of the Rings Trilogy"), k)
    assert.strictEqual(normaliseSeriesName("Lord Of The Rings"), k)
    assert.strictEqual(
      normaliseSeriesName("The Expanse Series"),
      normaliseSeriesName("Expanse"),
    )
    assert.strictEqual(
      normaliseSeriesName("Dark Tower Saga"),
      normaliseSeriesName("The Dark Tower"),
    )
  })

  it("keeps different series apart", () => {
    assert.notStrictEqual(
      normaliseSeriesName("Dune"),
      normaliseSeriesName("Dune Chronicles"),
    )
  })
})

describe("chooseCanonical", () => {
  it("prefers the name used by the most books", () => {
    assert.strictEqual(chooseCanonical([e("a b", 5), e("A B", 2)]).name, "a b")
  })

  it("breaks ties with proper capitalisation, then length", () => {
    assert.strictEqual(
      chooseCanonical([
        e("j. k. rowling"),
        e("J. K. ROWLING"),
        e("J. K. Rowling"),
      ]).name,
      "J. K. Rowling",
    )
    assert.strictEqual(
      chooseCanonical([e("Ursula Le Guin"), e("Ursula K. Le Guin")]).name,
      "Ursula K. Le Guin",
    )
  })
})

describe("groupDuplicates", () => {
  it("groups only equal keys", () => {
    const merges = groupDuplicates("author", [
      e("J.R.R. Tolkien", 3),
      e("J. R. R. Tolkien", 1),
      e("Jon Smith"),
      e("John Smith"),
    ])
    assert.strictEqual(merges.length, 1)
    assert.strictEqual(merges[0]?.target.name, "J.R.R. Tolkien")
    assert.strictEqual(merges[0]?.sources.length, 1)
  })
})

describe("runTidy on the test database", () => {
  async function setup() {
    const { setupTestDb, seedBooks } =
      await import("@/__tests__/harness/testDb")
    const ctx = setupTestDb()
    const books = seedBooks(ctx, [
      { title: "One" },
      { title: "Two" },
      { title: "Three" },
    ])
    return { ctx, books }
  }

  it("merges duplicate authors and keeps roles and links", async () => {
    const { runTidy, planTidy } = await import("@/libraryTidy")
    const { ctx, books } = await setup()
    using _ctx = ctx
    const sql = ctx.sqlite
    const creator = (name: string) =>
      (
        sql
          .prepare(
            `INSERT INTO creator (name, file_as) VALUES (?, ?) RETURNING uuid`,
          )
          .get(name, name) as { uuid: string }
      ).uuid
    const link = (book: string, c: string, role: string) =>
      sql
        .prepare(
          `INSERT INTO book_to_creator (book_uuid, creator_uuid, role) VALUES (?, ?, ?)`,
        )
        .run(book, c, role)
    const good = creator("J. R. R. Tolkien")
    const dup = creator("j.r.r. tolkien")
    const other = creator("Jon Smith")
    link(books[0] as string, good, "aut")
    link(books[1] as string, dup, "aut")
    link(books[1] as string, dup, "nrt")
    link(books[2] as string, other, "aut")

    const plan = await planTidy()
    assert.strictEqual(plan.merges.length, 1)

    const dry = await runTidy({ dryRun: true })
    assert.strictEqual(dry.merges[0]?.merged, false)
    assert.strictEqual(
      (sql.prepare(`SELECT count(*) c FROM creator`).get() as { c: number }).c,
      3,
    )

    const result = await runTidy()
    assert.strictEqual(result.merges[0]?.merged, true)
    const rows = sql
      .prepare(
        `SELECT creator_uuid, role, book_uuid FROM book_to_creator WHERE creator_uuid = ?`,
      )
      .all(good) as { role: string }[]
    assert.strictEqual(rows.length, 3)
    assert.ok(rows.some((r) => r.role === "nrt"))
    assert.strictEqual(
      sql.prepare(`SELECT 1 FROM creator WHERE uuid = ?`).get(dup),
      undefined,
    )
    assert.strictEqual((await planTidy()).merges.length, 0)
  })

  it("merges duplicate series and keeps the lowest position", async () => {
    const { runTidy } = await import("@/libraryTidy")
    const { ctx, books } = await setup()
    using _ctx = ctx
    const sql = ctx.sqlite
    const series = (name: string) =>
      (
        sql
          .prepare(`INSERT INTO series (name) VALUES (?) RETURNING uuid`)
          .get(name) as { uuid: string }
      ).uuid
    const link = (book: string, s: string, position: number | null) =>
      sql
        .prepare(
          `INSERT INTO book_to_series (book_uuid, series_uuid, position) VALUES (?, ?, ?)`,
        )
        .run(book, s, position)
    const main = series("The Expanse")
    const dup = series("Expanse Series")
    const dup2 = series("the expanse")
    link(books[0] as string, main, 1)
    link(books[0] as string, dup, 7)
    link(books[1] as string, dup, 4)
    link(books[1] as string, dup2, 2)
    link(books[2] as string, dup2, null)

    await runTidy()

    const rows = sql
      .prepare(
        `SELECT series_uuid, book_uuid, position FROM book_to_series ORDER BY book_uuid`,
      )
      .all() as {
      series_uuid: string
      book_uuid: string
      position: number | null
    }[]
    assert.strictEqual(rows.length, 3)
    const byBook = new Map(rows.map((r) => [r.book_uuid, r]))
    assert.strictEqual(byBook.get(books[0] as string)?.position, 1)
    assert.strictEqual(byBook.get(books[1] as string)?.position, 2)
    assert.strictEqual(byBook.get(books[2] as string)?.position, null)
    assert.strictEqual(
      (sql.prepare(`SELECT count(*) c FROM series`).get() as { c: number }).c,
      1,
    )
  })
})
