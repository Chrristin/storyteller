import { describe, expect, it, vi } from "vitest"

import {
  type TestDbContext,
  seedBooks,
  setupTestDb,
} from "@/__tests__/harness/testDb"
import {
  getBookForIdentify,
  getIdentityCounts,
  listBooksToIdentify,
  listReview,
  resetNonAccepted,
  saveIdentity,
} from "@/database/hardcoverIdentity"
import { type UUID } from "@/uuid"

import { acceptAllSure, acceptSelected } from "../apply"
import { HardcoverAuthError } from "../client"
import {
  type IdentifyDeps,
  buildQuery,
  getIdentifyProgress,
  runIdentify,
} from "../identifyJob"

import * as f from "./fixtures"

vi.mock("@/writeToFiles/fileWriteDistributor", () => ({
  queueWritesToFiles: async () => {},
}))

function addAuthor(ctx: TestDbContext, bookUuid: string, name: string) {
  const creator = ctx.sqlite
    .prepare(`INSERT INTO creator (name, file_as) VALUES (?, ?) RETURNING uuid`)
    .get(name, name) as { uuid: string }
  ctx.sqlite
    .prepare(
      `INSERT INTO book_to_creator (book_uuid, creator_uuid, role) VALUES (?, ?, 'aut')`,
    )
    .run(bookUuid, creator.uuid)
}

function addSeries(
  ctx: TestDbContext,
  bookUuid: string,
  name: string,
  position: number | null = null,
) {
  const existing = ctx.sqlite
    .prepare(`SELECT uuid FROM series WHERE name = ?`)
    .get(name) as { uuid: string } | undefined
  const uuid =
    existing?.uuid ??
    (
      ctx.sqlite
        .prepare(`INSERT INTO series (name) VALUES (?) RETURNING uuid`)
        .get(name) as { uuid: string }
    ).uuid
  ctx.sqlite
    .prepare(
      `INSERT INTO book_to_series (book_uuid, series_uuid, position) VALUES (?, ?, ?)`,
    )
    .run(bookUuid, uuid, position)
}

function seriesRows(ctx: TestDbContext) {
  return ctx.sqlite
    .prepare(
      `SELECT series.name AS name, b.title AS title, bs.position AS position
       FROM book_to_series bs JOIN series ON series.uuid = bs.series_uuid
       JOIN book b ON b.uuid = bs.book_uuid ORDER BY series.name, b.title`,
    )
    .all() as { name: string; title: string; position: number | null }[]
}

function tagRows(ctx: TestDbContext) {
  return ctx.sqlite
    .prepare(
      `SELECT tag.name AS name, b.title AS title FROM book_to_tag bt
       JOIN tag ON tag.uuid = bt.tag_uuid JOIN book b ON b.uuid = bt.book_uuid
       ORDER BY tag.name, b.title`,
    )
    .all() as { name: string; title: string }[]
}

describe("hardcover identity table", () => {
  it("lists books to identify, resets and counts", async () => {
    using ctx = setupTestDb()
    const [a, b, c] = seedBooks(ctx, [
      { title: "A" },
      { title: "B" },
      { title: "C" },
    ]) as [UUID, UUID, UUID]
    expect((await listBooksToIdentify()).sort()).toEqual([a, b, c].sort())

    await saveIdentity(a, {
      status: "sure",
      seriesName: "S",
      genres: ["Fantasy"],
    })
    await saveIdentity(b, { status: "none" })
    await saveIdentity(c, { status: "error", error: "boom" })
    expect(await listBooksToIdentify()).toEqual([c])

    await ctx.db
      .updateTable("hardcoverIdentity")
      .set({ status: "accepted" })
      .where("bookUuid", "=", a)
      .execute()
    await resetNonAccepted()
    expect((await listBooksToIdentify()).sort()).toEqual([b, c].sort())

    const counts = await getIdentityCounts()
    expect(counts.accepted).toBe(1)
    expect(counts.pending).toBe(2)
    expect(counts.unchecked).toBe(0)

    // Deleting a book removes its row.
    ctx.sqlite.prepare(`DELETE FROM book WHERE uuid = ?`).run(a)
    expect((await getIdentityCounts()).accepted).toBe(0)
  })

  it("reads the book for a lookup and pages the review", async () => {
    using ctx = setupTestDb()
    const [a] = seedBooks(ctx, [{ title: "Caliban's War" }]) as [UUID]
    addAuthor(ctx, a, "James S. A. Corey")
    addSeries(ctx, a, "Expanse 02")
    const book = await getBookForIdentify(a)
    expect(book).toMatchObject({
      title: "Caliban's War",
      authors: ["James S. A. Corey"],
      seriesNames: ["Expanse 02"],
    })

    await saveIdentity(a, {
      status: "sure",
      seriesName: "The Expanse",
      seriesPosition: 2,
      genres: ["Science Fiction"],
      moods: ["tense"],
      matchedTitle: "Caliban's War",
      matchedAuthors: ["James S.A. Corey"],
    })
    const page = await listReview("sure")
    expect(page.total).toBe(1)
    expect(page.nextCursor).toBeNull()
    expect(page.items[0]).toMatchObject({
      title: "Caliban's War",
      currentSeries: ["Expanse 02"],
      suggestedSeries: "The Expanse",
      suggestedPosition: 2,
      genres: ["Science Fiction"],
      moods: ["tense"],
    })
    expect((await listReview("check")).items).toHaveLength(0)
  })
})

describe("acceptAllSure", () => {
  it("attaches to a similar existing series, never duplicates, whole positions only", async () => {
    using ctx = setupTestDb()
    const [leviathan, caliban, falls, novella, check] = seedBooks(ctx, [
      { title: "Leviathan Wakes" },
      { title: "Caliban's War" },
      { title: "Leviathan Falls" },
      { title: "The Churn" },
      { title: "Dune" },
    ]) as UUID[] as [UUID, UUID, UUID, UUID, UUID]
    // The library already has "Expanse" with one book in it.
    addSeries(ctx, leviathan, "Expanse", 1)
    // Caliban's War sits in a loose "Expanse 02" pile.
    addSeries(ctx, caliban, "Expanse 02")

    const sure = (
      uuid: UUID,
      position: number | null,
      genres: string[] = ["Science Fiction"],
    ) =>
      saveIdentity(uuid, {
        status: "sure",
        seriesName: "The Expanse",
        seriesPosition: position,
        genres,
      })
    await sure(leviathan, 1)
    await sure(caliban, 2)
    await sure(falls, 9)
    await sure(novella, 2.5, ["Science Fiction", "Space Opera"])
    await saveIdentity(check, {
      status: "check",
      seriesName: "Dune",
      genres: ["Fantasy"],
    })
    ctx.sqlite
      .prepare(`INSERT INTO tag (name) VALUES ('science fiction')`)
      .run()

    const result = await acceptAllSure()
    expect(result).toEqual({
      // Leviathan Wakes ("Expanse") and Caliban's War ("Expanse 02") are
      // already in a series with the same normalised name.
      seriesAdded: 2,
      tagsAdded: 5,
      skipped: 2,
      accepted: 4,
    })

    // No duplicate series: the new books joined "Expanse".
    const series = ctx.sqlite
      .prepare(`SELECT name FROM series ORDER BY name`)
      .all()
    expect(series).toEqual([{ name: "Expanse" }, { name: "Expanse 02" }])
    expect(seriesRows(ctx)).toEqual([
      { name: "Expanse", title: "Leviathan Falls", position: 9 },
      { name: "Expanse", title: "Leviathan Wakes", position: 1 },
      // half step: joins the series but without a position
      { name: "Expanse", title: "The Churn", position: null },
      // the old loose series is never removed
      { name: "Expanse 02", title: "Caliban's War", position: null },
    ])

    // The existing lowercase tag is reused, no second "Science Fiction".
    const tags = tagRows(ctx)
    expect(tags.filter((tag) => tag.name === "science fiction")).toHaveLength(4)
    expect(tags.filter((tag) => tag.name === "Science Fiction")).toHaveLength(0)
    expect(tags.filter((tag) => tag.name === "Space Opera")).toHaveLength(1)

    // 'check' was not applied; sure rows are accepted.
    expect((await listReview("check")).items).toHaveLength(1)
    expect((await listReview("accepted")).total).toBe(4)
    expect((await listReview("sure")).total).toBe(0)

    // Running it again changes nothing.
    expect(await acceptAllSure()).toEqual({
      seriesAdded: 0,
      tagsAdded: 0,
      skipped: 0,
      accepted: 0,
    })
  })

  it("accepts only the selected check rows, like accept all does", async () => {
    using ctx = setupTestDb()
    const [a, b, c, none, accepted, sure] = seedBooks(ctx, [
      { title: "Alpha" },
      { title: "Beta" },
      { title: "Gamma" },
      { title: "Delta" },
      { title: "Epsilon" },
      { title: "Zeta" },
    ]) as UUID[] as [UUID, UUID, UUID, UUID, UUID, UUID]
    const row = (status: "check" | "none" | "accepted" | "sure", n: number) =>
      saveIdentity(
        { check: a, none, accepted, sure }[
          status === "check" ? "check" : status
        ],
        {
          status,
          seriesName: "The Saga",
          seriesPosition: n,
          genres: ["Fantasy"],
        },
      )
    await row("check", 1)
    await saveIdentity(b, {
      status: "check",
      seriesName: "The Saga",
      seriesPosition: 2,
      genres: ["Fantasy"],
    })
    await saveIdentity(c, {
      status: "check",
      seriesName: "Other",
      seriesPosition: 1,
    })
    await row("none", 9)
    await row("accepted", 9)
    await row("sure", 3)

    // Beta and Gamma are never selected. None and accepted rows are ignored
    // even when sent; the sure row is applied like accept all would.
    const result = await acceptSelected([a, none, accepted, sure])
    expect(result).toEqual({
      seriesAdded: 2,
      tagsAdded: 2,
      skipped: 0,
      accepted: 2,
    })
    expect(seriesRows(ctx)).toEqual([
      { name: "The Saga", title: "Alpha", position: 1 },
      { name: "The Saga", title: "Zeta", position: 3 },
    ])
    expect(
      (await listReview("check")).items.map((i) => i.title).sort(),
    ).toEqual(["Beta", "Gamma"])
    expect((await listReview("accepted")).total).toBe(3)
    expect((await listReview("none")).total).toBe(1)

    // Asking again for an accepted book, or for nothing, changes nothing.
    expect(await acceptSelected([a])).toEqual({
      seriesAdded: 0,
      tagsAdded: 0,
      skipped: 0,
      accepted: 0,
    })
    expect((await acceptSelected([])).accepted).toBe(0)
  })

  it("creates the series when the library has none, and reuses it", async () => {
    using ctx = setupTestDb()
    const [one, two] = seedBooks(ctx, [{ title: "One" }, { title: "Two" }]) as [
      UUID,
      UUID,
    ]
    await saveIdentity(one, {
      status: "sure",
      seriesName: "The Saga",
      seriesPosition: 1,
    })
    await saveIdentity(two, {
      status: "sure",
      seriesName: "The Saga",
      seriesPosition: 2,
    })
    const result = await acceptAllSure()
    expect(result.seriesAdded).toBe(2)
    expect(ctx.sqlite.prepare(`SELECT name FROM series`).all()).toEqual([
      { name: "The Saga" },
    ])
    const rows = ctx.sqlite
      .prepare(`SELECT featured FROM book_to_series`)
      .all() as { featured: number }[]
    expect(rows.every((row) => row.featured === 1)).toBe(true)
  })
})

describe("identify job", () => {
  function deps(overrides: Partial<IdentifyDeps> = {}): IdentifyDeps {
    return {
      getToken: async () => "token",
      search: async () => [],
      sleep: async () => {},
      paceMs: 0,
      ...overrides,
    }
  }

  it("sends only the title and the first author", () => {
    expect(
      buildQuery("The Two Towers (Lord of the Rings #2)", [
        "J.R.R. Tolkien",
        "X",
      ]),
    ).toBe("The Two Towers J.R.R. Tolkien")
  })

  it("builds the query without noise or a track number", () => {
    expect(
      buildQuery("01 Eye of the World (Unabridged)", ["Robert Jordan"]),
    ).toBe("Eye of the World Robert Jordan")
    expect(buildQuery("14 A Memory of Light", ["Robert Jordan"], [14])).toBe(
      "A Memory of Light Robert Jordan",
    )
    expect(buildQuery("1984", ["George Orwell"])).toBe("1984 George Orwell")
  })

  it("identifies new books, one search each, and records the result", async () => {
    using ctx = setupTestDb()
    const [tt, untitled, unknown] = seedBooks(ctx, [
      { title: "The Two Towers" },
      { title: "  " },
      { title: "Obscure Thing" },
    ]) as [UUID, UUID, UUID]
    addAuthor(ctx, tt, "J.R.R. Tolkien")
    addAuthor(ctx, unknown, "Nobody")
    const queries: string[] = []
    const progress = await runIdentify(
      "new",
      deps({
        search: async (_token, query) => {
          queries.push(query)
          return query.startsWith("The Two Towers") ? [f.twoTowers] : []
        },
      }),
    )
    expect(queries.sort()).toEqual([
      "Obscure Thing Nobody",
      "The Two Towers J.R.R. Tolkien",
    ])
    expect(progress).toMatchObject({
      running: false,
      total: 3,
      done: 3,
      sure: 1,
      none: 1,
    })
    const counts = await getIdentityCounts()
    expect(counts.sure).toBe(1)
    expect(counts.none).toBe(1)
    // The untitled book was skipped, so it is still waiting.
    expect(await listBooksToIdentify()).toEqual([untitled])

    // A second "new" run only looks at what is left.
    queries.length = 0
    await runIdentify(
      "new",
      deps({
        search: async (_t, q) => {
          queries.push(q)
          return []
        },
      }),
    )
    expect(queries).toEqual([])
  })

  it("'all' resets everything that is not accepted", async () => {
    using ctx = setupTestDb()
    const [a, b] = seedBooks(ctx, [
      { title: "A Book" },
      { title: "B Book" },
    ]) as [UUID, UUID]
    await saveIdentity(a, { status: "none" })
    await saveIdentity(b, { status: "sure" })
    await ctx.db
      .updateTable("hardcoverIdentity")
      .set({ status: "accepted" })
      .where("bookUuid", "=", b)
      .execute()
    const seen: string[] = []
    await runIdentify(
      "all",
      deps({
        search: async (_t, q) => {
          seen.push(q)
          return []
        },
      }),
    )
    expect(seen).toEqual(["A Book"])
    expect((await getIdentityCounts()).accepted).toBe(1)
  })

  it("stops on a rejected token and after repeated failures", async () => {
    using ctx = setupTestDb()
    seedBooks(ctx, [
      { title: "A1" },
      { title: "A2" },
      { title: "A3" },
      { title: "A4" },
    ])
    let calls = 0
    const auth = await runIdentify(
      "new",
      deps({
        search: async () => {
          calls += 1
          throw new HardcoverAuthError()
        },
      }),
    )
    expect(calls).toBe(1)
    expect(auth.lastError).toMatch(/token/i)
    expect(auth.running).toBe(false)

    calls = 0
    const failing = await runIdentify(
      "new",
      deps({
        search: async () => {
          calls += 1
          throw new Error("down")
        },
      }),
    )
    expect(calls).toBe(3)
    expect(failing.error).toBe(3)
    expect(failing.lastError).toMatch(/3 failures/)
    expect(getIdentifyProgress().running).toBe(false)
  })

  it("does nothing without a token", async () => {
    using ctx = setupTestDb()
    seedBooks(ctx, [{ title: "A1" }])
    const progress = await runIdentify(
      "new",
      deps({ getToken: async () => null }),
    )
    expect(progress.lastError).toMatch(/token/i)
    expect(progress.total).toBe(0)
  })
})
