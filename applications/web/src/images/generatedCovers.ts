import { type BookWithRelations, getBook, touchBook } from "@/database/books"
/**
 * Attaches drawn covers (origin "generated") to ebooks and read-alouds that
 * have no cover. Audiobooks are never given one, a cover the user removed
 * ("cleared") stays removed, and anything that already has an image, whether
 * extracted or uploaded, is left alone. A real cover found later replaces a
 * generated one (see shouldExtractCover).
 */
import { db } from "@/database/connection"
import {
  type CoverFormat,
  type CoverOrigin,
  type Image,
  setFormatCover,
} from "@/database/images"

import { renderGeneratedCover } from "./generatedCover"
import { ingestImage } from "./ingest"

type TextFormat = Extract<CoverFormat, "ebook" | "readaloud">

type CoverRow = {
  cover: unknown
  coverOrigin: CoverOrigin
} | null

/** a format may get a generated cover only if it has no cover and no opinion */
export function canGenerateCover(row: CoverRow | undefined): boolean {
  return !!row && row.coverOrigin === "unset" && !row.cover
}

export function textFormatsNeedingCover(book: BookWithRelations): TextFormat[] {
  const formats: TextFormat[] = []
  if (canGenerateCover(book.ebook)) formats.push("ebook")
  if (canGenerateCover(book.readaloud)) formats.push("readaloud")
  return formats
}

export async function generateImageForBook(
  book: Pick<BookWithRelations, "title" | "authors">,
): Promise<Image | null> {
  const cover = await renderGeneratedCover(
    book.title,
    book.authors[0]?.name ?? null,
  )
  return await ingestImage(cover.data, { sourceName: cover.filename })
}

/**
 * draws and attaches a cover to every text format of the book that has none.
 * returns the formats that were given one.
 */
export async function generateCoverForBook(
  book: BookWithRelations,
  only?: TextFormat[],
): Promise<TextFormat[]> {
  const formats = textFormatsNeedingCover(book).filter(
    (format) => !only || only.includes(format),
  )
  if (formats.length === 0) return []

  const image = await generateImageForBook(book)
  if (!image) return []

  for (const format of formats) {
    await setFormatCover(format, book.uuid, {
      imageUuid: image.uuid,
      origin: "generated",
      extractedFrom: null,
    })
  }
  await touchBook(book.uuid)
  return formats
}

export type GenerateMissingCoversResult = {
  generated: number
  skipped: number
}

/**
 * fills in covers for books already in the library. manual only: nothing calls
 * this on a schedule.
 */
export async function generateMissingCovers(): Promise<GenerateMissingCoversResult> {
  const rows = await db
    .selectFrom("book")
    .select("book.uuid")
    .where((eb) =>
      eb.or([
        eb.exists(
          eb
            .selectFrom("ebook")
            .select((inner) => inner.lit(1).as("one"))
            .whereRef("ebook.bookUuid", "=", "book.uuid")
            .where("ebook.coverOrigin", "=", "unset")
            .where("ebook.coverImageUuid", "is", null),
        ),
        eb.exists(
          eb
            .selectFrom("readaloud")
            .select((inner) => inner.lit(1).as("one"))
            .whereRef("readaloud.bookUuid", "=", "book.uuid")
            .where("readaloud.coverOrigin", "=", "unset")
            .where("readaloud.coverImageUuid", "is", null),
        ),
      ]),
    )
    .execute()

  let generated = 0
  let skipped = 0

  for (const row of rows) {
    try {
      const book = await getBook(row.uuid)
      const done = book ? await generateCoverForBook(book) : []
      if (done.length > 0) generated++
      else skipped++
    } catch {
      skipped++
    }
  }

  return { generated, skipped }
}
