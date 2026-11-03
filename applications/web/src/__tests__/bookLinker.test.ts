import assert from "node:assert"

import { describe, it } from "vitest"

import { findLinkPairs } from "@/bookLinker"
import { type BookWithRelations } from "@/database/books"

type Fake = {
  uuid: string
  title: string
  format: "ebook" | "audiobook" | "both"
  authors?: string[]
  series?: { name: string; position: number }[]
  isbn?: string
  asin?: string
}

function book(f: Fake): BookWithRelations {
  const ident = (kind: string, value: string) => ({ kind, value })
  return {
    uuid: f.uuid,
    title: f.title,
    subtitle: null,
    authors: (f.authors ?? []).map((name) => ({ uuid: `a-${name}`, name })),
    narrators: [],
    creators: [],
    series: f.series ?? [],
    tags: [],
    collections: [],
    identifiers: [
      ...(f.isbn ? [ident("isbn-13", f.isbn)] : []),
      ...(f.asin ? [ident("asin", f.asin)] : []),
    ],
    publicationDate: null,
    duration: null,
    pageCount: null,
    ebook: f.format !== "audiobook" ? { identifiers: [] } : null,
    audiobook: f.format !== "ebook" ? { identifiers: [] } : null,
    readaloud: null,
  } as unknown as BookWithRelations
}

describe("findLinkPairs", () => {
  it("pairs an ebook and audiobook with the same title and author", () => {
    const pairs = findLinkPairs([
      book({
        uuid: "e1",
        title: "My Sister, the Serial Killer",
        format: "ebook",
        authors: ["Oyinkan Braithwaite"],
      }),
      book({
        uuid: "a1",
        title: "My Sister, the Serial Killer: A Novel",
        format: "audiobook",
        authors: ["Oyinkan Braithwaite"],
      }),
    ])
    assert.strictEqual(pairs.length, 1)
    assert.strictEqual(pairs[0]?.ebookBook.uuid, "e1")
    assert.strictEqual(pairs[0]?.audiobookBook.uuid, "a1")
  })

  it("pairs on a shared identifier even when the titles differ a little", () => {
    const pairs = findLinkPairs([
      book({
        uuid: "e1",
        title: "The Fellowship of the Ring",
        format: "ebook",
        isbn: "9780261102354",
      }),
      book({
        uuid: "a1",
        title: "The Fellowship Of The Ring (BBC Dramatisation)",
        format: "audiobook",
        isbn: "9780261102354",
      }),
    ])
    assert.strictEqual(pairs.length, 1)
    assert.strictEqual(pairs[0]?.reason, "identifier")
  })

  it("does not pair different authors", () => {
    const pairs = findLinkPairs([
      book({
        uuid: "e1",
        title: "Home",
        format: "ebook",
        authors: ["Toni Morrison"],
      }),
      book({
        uuid: "a1",
        title: "Home",
        format: "audiobook",
        authors: ["Harlan Coben"],
      }),
    ])
    assert.strictEqual(pairs.length, 0)
  })

  it("does not pair different books in a numbered series", () => {
    const pairs = findLinkPairs([
      book({
        uuid: "e1",
        title: "Harry Potter, Book 1",
        format: "ebook",
        authors: ["J.K. Rowling"],
      }),
      book({
        uuid: "a2",
        title: "Harry Potter, Book 2",
        format: "audiobook",
        authors: ["J.K. Rowling"],
      }),
    ])
    assert.strictEqual(pairs.length, 0)
  })

  it("does not pair when series positions disagree", () => {
    const pairs = findLinkPairs([
      book({
        uuid: "e1",
        title: "Dragon",
        format: "ebook",
        authors: ["A Writer"],
        series: [{ name: "Saga", position: 1 }],
      }),
      book({
        uuid: "a1",
        title: "Dragon",
        format: "audiobook",
        authors: ["A Writer"],
        series: [{ name: "Saga", position: 2 }],
      }),
    ])
    assert.strictEqual(pairs.length, 0)
  })

  it("does nothing when two audiobooks look equally right", () => {
    const pairs = findLinkPairs([
      book({
        uuid: "e1",
        title: "Dune",
        format: "ebook",
        authors: ["Frank Herbert"],
      }),
      book({
        uuid: "a1",
        title: "Dune",
        format: "audiobook",
        authors: ["Frank Herbert"],
      }),
      book({
        uuid: "a2",
        title: "Dune",
        format: "audiobook",
        authors: ["Frank Herbert"],
      }),
    ])
    assert.strictEqual(pairs.length, 0)
  })

  it("leaves books that already have both formats alone", () => {
    const pairs = findLinkPairs([
      book({
        uuid: "b1",
        title: "Dune",
        format: "both",
        authors: ["Frank Herbert"],
      }),
      book({
        uuid: "a1",
        title: "Dune",
        format: "audiobook",
        authors: ["Frank Herbert"],
      }),
    ])
    assert.strictEqual(pairs.length, 0)
  })
})

describe("keepUserData", () => {
  it("keeps the reading status and rating of the book that is merged away", async () => {
    const { randomUUID } = await import("node:crypto")
    const { setupTestDb, seedBooks } =
      await import("@/__tests__/harness/testDb")
    const { keepUserData } = await import("@/bookLinker")
    const { getBook, updateBook } = await import("@/database/books")
    type U = import("@/uuid").UUID

    using ctx = setupTestDb()
    const permission = ctx.sqlite
      .prepare(`INSERT INTO user_permission DEFAULT VALUES RETURNING uuid`)
      .get() as { uuid: string }
    const user = ctx.sqlite
      .prepare(
        `INSERT INTO user (user_permission_uuid, email) VALUES (?, ?) RETURNING id`,
      )
      .get(permission.uuid, `${randomUUID()}@example.com`) as { id: string }
    const [ebook, audio] = seedBooks(ctx, [
      { title: "Dune", ebook: "dune.epub" },
      { title: "Dune (audio)", audiobook: "dune-audio" },
    ]) as [U, U]
    const status = ctx.sqlite
      .prepare(`INSERT INTO status (name) VALUES ('Reading') RETURNING uuid`)
      .get() as { uuid: string }
    ctx.sqlite
      .prepare(
        `INSERT INTO book_to_status (book_uuid, status_uuid, user_id) VALUES (?, ?, ?)`,
      )
      .run(audio, status.uuid, user.id)
    ctx.sqlite
      .prepare(
        `INSERT INTO user_book_rating (user_id, book_uuid, rating) VALUES (?, ?, 4)`,
      )
      .run(user.id, audio)

    await keepUserData(ebook, audio)
    await updateBook(ebook, null, { books: [audio] })

    const merged = await getBook(ebook, user.id as U)
    assert.ok(merged?.ebook && merged.audiobook, "both formats on one book")
    assert.strictEqual(merged.status?.name, "Reading")
    const rating = ctx.sqlite
      .prepare(`SELECT rating FROM user_book_rating WHERE book_uuid = ?`)
      .get(ebook) as { rating: number } | undefined
    assert.strictEqual(rating?.rating, 4)
  })
})
