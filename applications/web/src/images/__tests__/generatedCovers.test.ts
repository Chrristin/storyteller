import assert from "node:assert"

import { describe, it } from "vitest"

import { setupTestDb } from "@/__tests__/harness/testDb"
import { getBook } from "@/database/books"
import { type CoverOrigin, setFormatCover } from "@/database/images"
import { type UUID } from "@/uuid"

import { attachCover, shouldExtractCover, textCoverTargets } from "../covers"
import { generateImageForBook } from "../generatedCovers"
import {
  canGenerateCover,
  generateCoverForBook,
  generateMissingCovers,
} from "../generatedCovers"

function seed(
  ctx: ReturnType<typeof setupTestDb>,
  title: string,
  formats: ("ebook" | "audiobook" | "readaloud")[],
) {
  const row = ctx.sqlite
    .prepare(`INSERT INTO book (title, asset_dir) VALUES (?, ?) RETURNING uuid`)
    .get(title, title) as { uuid: UUID }
  for (const format of formats) {
    if (format === "readaloud") {
      ctx.sqlite
        .prepare(
          `INSERT INTO readaloud (book_uuid, filepath, status, current_stage) VALUES (?, ?, 'ALIGNED', 'SPLIT_TRACKS')`,
        )
        .run(row.uuid, `/tmp/${title}.epub`)
    } else {
      ctx.sqlite
        .prepare(`INSERT INTO ${format} (book_uuid, filepath) VALUES (?, ?)`)
        .run(row.uuid, `/tmp/${title}`)
    }
  }
  return row.uuid
}

function origins(book: NonNullable<Awaited<ReturnType<typeof getBook>>>) {
  return {
    ebook: book.ebook?.coverOrigin,
    audiobook: book.audiobook?.coverOrigin,
    readaloud: book.readaloud?.coverOrigin,
  }
}

describe("generated covers", () => {
  it("gives a cover-less ebook a generated cover with blurhash and colors", async () => {
    using ctx = setupTestDb()
    const uuid = seed(ctx, "Cover-less", ["ebook"])
    const book = await getBook(uuid)
    assert.ok(book)
    assert.deepStrictEqual(await generateCoverForBook(book), ["ebook"])

    const after = await getBook(uuid)
    assert.strictEqual(after?.ebook?.coverOrigin, "generated")
    assert.ok(after?.ebook?.cover?.sha256)
    assert.ok(after?.ebook?.cover?.blurhash)
    assert.ok(after?.ebook?.cover?.colors?.length)
  })

  it("covers both the ebook and the readaloud of one book with the same image", async () => {
    using ctx = setupTestDb()
    const uuid = seed(ctx, "Both", ["ebook", "readaloud"])
    const book = await getBook(uuid)
    assert.ok(book)
    await generateCoverForBook(book)
    const after = await getBook(uuid)
    assert.strictEqual(
      after?.ebook?.cover?.sha256,
      after?.readaloud?.cover?.sha256,
    )
    assert.deepStrictEqual(origins(after!), {
      ebook: "generated",
      audiobook: undefined,
      readaloud: "generated",
    })
  })

  it("does not touch an audiobook, even next to an ebook", async () => {
    using ctx = setupTestDb()
    const audioOnly = seed(ctx, "Audio only", ["audiobook"])
    const both = seed(ctx, "Audio and ebook", ["audiobook", "ebook"])

    assert.deepStrictEqual(await generateMissingCovers(), {
      generated: 1,
      skipped: 0,
    })

    const a = await getBook(audioOnly)
    assert.strictEqual(a?.audiobook?.coverOrigin, "unset")
    assert.strictEqual(a?.audiobook?.cover, null)
    const b = await getBook(both)
    assert.strictEqual(b?.audiobook?.coverOrigin, "unset")
    assert.strictEqual(b?.audiobook?.cover, null)
    assert.strictEqual(b?.ebook?.coverOrigin, "generated")
  })

  it("leaves real, user and cleared covers alone", async () => {
    using ctx = setupTestDb()
    const real = seed(ctx, "Real", ["ebook"])
    const user = seed(ctx, "User", ["ebook"])
    const cleared = seed(ctx, "Cleared", ["ebook"])

    const image = await generateImageForBook({
      title: "Elsewhere",
      authors: [],
    })
    assert.ok(image)
    await setFormatCover("ebook", real, {
      imageUuid: image.uuid,
      origin: "extracted",
      extractedFrom: "fp",
    })
    await setFormatCover("ebook", user, {
      imageUuid: image.uuid,
      origin: "user",
    })
    await setFormatCover("ebook", cleared, {
      imageUuid: null,
      origin: "cleared",
    })

    assert.deepStrictEqual(await generateMissingCovers(), {
      generated: 0,
      skipped: 0,
    })
    assert.strictEqual((await getBook(real))?.ebook?.coverOrigin, "extracted")
    assert.strictEqual((await getBook(user))?.ebook?.coverOrigin, "user")
    const c = await getBook(cleared)
    assert.strictEqual(c?.ebook?.coverOrigin, "cleared")
    assert.strictEqual(c?.ebook?.cover, null)
  })

  it("is idempotent", async () => {
    using ctx = setupTestDb()
    seed(ctx, "Once", ["ebook"])
    assert.strictEqual((await generateMissingCovers()).generated, 1)
    assert.deepStrictEqual(await generateMissingCovers(), {
      generated: 0,
      skipped: 0,
    })
  })

  it("only an unset format without an image may get one", () => {
    const cover = { sha256: "x" }
    assert.ok(canGenerateCover({ coverOrigin: "unset", cover: null }))
    assert.ok(!canGenerateCover({ coverOrigin: "unset", cover }))
    assert.ok(!canGenerateCover({ coverOrigin: "cleared", cover: null }))
    assert.ok(!canGenerateCover({ coverOrigin: "user", cover: null }))
    assert.ok(!canGenerateCover({ coverOrigin: "generated", cover }))
    assert.ok(!canGenerateCover(null))
    assert.ok(!canGenerateCover(undefined))
  })

  it("is replaced by a real cover that arrives later", async () => {
    using ctx = setupTestDb()
    const uuid = seed(ctx, "Later", ["ebook"])
    const book = await getBook(uuid)
    assert.ok(book)
    await generateCoverForBook(book)

    const generated = await getBook(uuid)
    const current = {
      coverOrigin: "generated" as CoverOrigin,
      coverExtractedFrom: null,
    }
    for (const mode of ["merge", "always"] as const) {
      assert.ok(shouldExtractCover(mode, current, "same-fingerprint"))
    }
    assert.ok(!shouldExtractCover("skip", current, "fp"))

    const real = await generateImageForBook({
      title: "A real cover",
      authors: [],
    })
    assert.ok(real)
    await attachCover(uuid, textCoverTargets(generated!), real, "extracted")
    const after = await getBook(uuid)
    assert.strictEqual(after?.ebook?.coverOrigin, "extracted")
    assert.strictEqual(after?.ebook?.cover?.sha256, real.sha256)
    assert.notStrictEqual(
      after?.ebook?.cover?.sha256,
      generated?.ebook?.cover?.sha256,
    )
  })

  it("never re-extracts over a user cover or a cleared one", () => {
    for (const coverOrigin of ["user", "cleared"] as const) {
      assert.ok(
        !shouldExtractCover(
          "merge",
          { coverOrigin, coverExtractedFrom: null },
          "fp",
        ),
      )
    }
  })
})
