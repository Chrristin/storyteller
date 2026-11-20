import { sql } from "kysely"

import { deleteCachedCoverImages } from "@/assets/fs"
import { pathBelongsTo } from "@/assets/library/paths"
import { getDefaultSuffix, getSafeFilepathSegment } from "@/assets/paths"
import { addJoinExclusion } from "@/database/bookJoinExclusions"
import { type BookWithRelations, getBook } from "@/database/books"
import { db } from "@/database/connection"
import { ASSETS_DIR } from "@/directories"
import { BookEvents } from "@/events"
import { type UUID } from "@/uuid"

export class BookSplitError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message)
    this.name = "BookSplitError"
  }
}

/**
 * Splits the audiobook of a book that has both an ebook and an audiobook onto
 * a new book of its own. The reverse of a merge.
 *
 * The ebook stays on `bookUuid` with the reading status, rating and progress.
 * The new book gets copies of the descriptive fields and relations, the
 * audiobook row (with its cover, manifest, duration and fingerprint), the
 * identifiers that belong to the audiobook, and each user's audiobook
 * progress. The status and rating of every user are copied.
 *
 * Everything happens in one transaction. No file on disk is touched: a book
 * whose audiobook lives inside the internal asset directory is refused (409)
 * rather than moved, because a move cannot be undone with the database.
 */
export async function splitAudiobookFromBook(
  bookUuid: UUID,
  userId?: UUID,
): Promise<BookWithRelations> {
  const book = await getBook(bookUuid)
  if (!book) throw new BookSplitError(404, "Not found")
  if (book.readaloud) {
    throw new BookSplitError(
      400,
      "This book has a read-aloud. A read-aloud is made from the ebook and the audiobook together, so it cannot be split.",
    )
  }
  if (!book.ebook || !book.audiobook) {
    throw new BookSplitError(
      400,
      "Only a book that has both an ebook and an audiobook can be split.",
    )
  }
  if (pathBelongsTo(ASSETS_DIR, book.audiobook.filepath)) {
    throw new BookSplitError(
      409,
      "The audiobook files of this book are stored inside Storyteller's own folder. Splitting would mean moving them, which is not supported yet, so nothing was changed.",
    )
  }

  const audiobookUuid = book.audiobook.uuid
  let newUuid!: UUID

  await db.transaction().execute(async (tr) => {
    // Re-check inside the transaction: the book may have changed since.
    const audio = await tr
      .selectFrom("audiobook")
      .select(["uuid", "filepath"])
      .where("uuid", "=", audiobookUuid)
      .where("bookUuid", "=", bookUuid)
      .executeTakeFirst()
    const hasEbook = await tr
      .selectFrom("ebook")
      .select("uuid")
      .where("bookUuid", "=", bookUuid)
      .executeTakeFirst()
    const hasReadaloud = await tr
      .selectFrom("readaloud")
      .select("uuid")
      .where("bookUuid", "=", bookUuid)
      .executeTakeFirst()
    if (!audio || !hasEbook || hasReadaloud) {
      throw new BookSplitError(409, "The book changed. Try again.")
    }

    // Copied in SQL so dates and text keep their stored form.
    const { rows } = await sql<{ uuid: UUID }>`
      INSERT INTO book (id, title, subtitle, description, language,
        publication_date, release_date, archived_at)
      SELECT ABS(RANDOM()) % 9007199254740990 + 1, title, subtitle,
        description, language, publication_date, release_date, archived_at
      FROM book WHERE uuid = ${bookUuid}
      RETURNING uuid`.execute(tr)
    const row = rows[0]
    if (!row) throw new BookSplitError(404, "Not found")
    newUuid = row.uuid

    const desired = getSafeFilepathSegment(book.title)
    const collision = await tr
      .selectFrom("book")
      .select("uuid")
      .where("assetDir", "=", desired)
      .where("uuid", "!=", newUuid)
      .executeTakeFirst()
    await tr
      .updateTable("book")
      .set({
        assetDir: collision
          ? getSafeFilepathSegment(book.title, getDefaultSuffix(newUuid))
          : desired,
      })
      .where("uuid", "=", newUuid)
      .execute()

    // Relations are copied; the creator, series, tag and collection rows
    // themselves are shared.
    await sql`INSERT INTO book_to_creator (book_uuid, creator_uuid, role)
      SELECT ${newUuid}, creator_uuid, role FROM book_to_creator
      WHERE book_uuid = ${bookUuid}`.execute(tr)
    await sql`INSERT INTO book_to_series (book_uuid, series_uuid, position, featured)
      SELECT ${newUuid}, series_uuid, position, featured FROM book_to_series
      WHERE book_uuid = ${bookUuid}`.execute(tr)
    await sql`INSERT INTO book_to_tag (book_uuid, tag_uuid)
      SELECT ${newUuid}, tag_uuid FROM book_to_tag
      WHERE book_uuid = ${bookUuid}`.execute(tr)
    await sql`INSERT INTO book_to_collection (book_uuid, collection_uuid)
      SELECT ${newUuid}, collection_uuid FROM book_to_collection
      WHERE book_uuid = ${bookUuid}`.execute(tr)

    // Per-user data: status and rating are copied.
    await sql`INSERT INTO book_to_status (book_uuid, status_uuid, user_id)
      SELECT ${newUuid}, status_uuid, user_id FROM book_to_status
      WHERE book_uuid = ${bookUuid}`.execute(tr)
    await sql`INSERT INTO user_book_rating (book_uuid, user_id, rating, review, dimensions)
      SELECT ${newUuid}, user_id, rating, review, dimensions FROM user_book_rating
      WHERE book_uuid = ${bookUuid}`.execute(tr)

    // The audiobook row moves with its cover image, fingerprint, manifest and
    // duration. Identifiers scoped to it follow; ASIN-like identifiers that
    // belong to the whole book are copied.
    await tr
      .updateTable("audiobook")
      .set({ bookUuid: newUuid })
      .where("uuid", "=", audiobookUuid)
      .execute()
    await tr
      .updateTable("identifier")
      .set({ bookUuid: newUuid })
      .where("audiobookUuid", "=", audiobookUuid)
      .execute()
    await sql`INSERT INTO identifier (book_uuid, identifier_type_uuid, value)
      SELECT ${newUuid}, i.identifier_type_uuid, i.value FROM identifier i
      JOIN identifier_type t ON t.uuid = i.identifier_type_uuid
      WHERE i.book_uuid = ${bookUuid}
      AND i.ebook_uuid IS NULL AND i.audiobook_uuid IS NULL AND i.readaloud_uuid IS NULL
      AND t.kind IN ('asin', 'audible')`.execute(tr)

    // Audiobook progress moves; ebook progress and the reading position
    // (which is an ebook locator) stay.
    await sql`UPDATE progression SET book_uuid = ${newUuid}
      WHERE book_uuid = ${bookUuid} AND format = 'audiobook'`.execute(tr)
    await sql`UPDATE progression_history SET book_uuid = ${newUuid}
      WHERE book_uuid = ${bookUuid} AND source_format = 'audiobook'`.execute(tr)

    // Scanner rules that point at the audiobook's path follow it.
    await sql`UPDATE import_rule SET book_uuid = ${newUuid}
      WHERE book_uuid = ${bookUuid}
      AND (path = ${audio.filepath}
        OR substr(path, 1, length(${audio.filepath}) + 1) = ${audio.filepath + "/"})`.execute(
      tr,
    )

    await sql`UPDATE book SET updated_at = CURRENT_TIMESTAMP
      WHERE uuid = ${bookUuid}`.execute(tr)

    await addJoinExclusion(tr, bookUuid, newUuid)
  })

  // a user who cannot see the new book (for example through a private
  // collection) still gets it back, the split itself was theirs
  const created = (await getBook(newUuid, userId)) ?? (await getBook(newUuid))
  if (!created) throw new Error(`Failed to retrieve book with uuid ${newUuid}`)

  // Cached covers are keyed by book and can be rebuilt, so dropping the
  // old book's cache is safe. No media file is touched.
  await deleteCachedCoverImages(bookUuid).catch(() => undefined)

  const remaining = await getBook(bookUuid, userId)
  if (remaining) {
    BookEvents.emit("message", {
      type: "bookUpdated",
      bookUuid,
      payload: remaining,
    })
  }
  BookEvents.emit("message", {
    type: "bookCreated",
    bookUuid: created.uuid,
    payload: created,
  })

  return created
}
