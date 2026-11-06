import { sql } from "kysely"

import { type UUID } from "@/uuid"

import { db } from "./connection"

export const MAX_NOTE_LENGTH = 5000

export type BookNoteWithAuthor = {
  uuid: UUID
  bookUuid: UUID
  userId: UUID
  /** Who wrote it: their name, else their username, else their email. */
  author: string
  body: string
  createdAt: string
  updatedAt: string
}

/** Every note on a book, oldest first. Anyone who can see the book can read them. */
export async function listBookNotes(
  bookUuid: UUID,
): Promise<BookNoteWithAuthor[]> {
  const rows = await db
    .selectFrom("bookNote")
    .innerJoin("user", "user.id", "bookNote.userId")
    .select([
      "bookNote.uuid",
      "bookNote.bookUuid",
      "bookNote.userId",
      "bookNote.body",
      "bookNote.createdAt",
      "bookNote.updatedAt",
      "user.name",
      "user.username",
      "user.email",
    ])
    .where("bookNote.bookUuid", "=", bookUuid)
    .orderBy("bookNote.createdAt", "asc")
    // Notes written in the same second keep the order they were written in.
    .orderBy(sql`book_note.rowid`, "asc")
    .execute()

  return rows.map(({ name, username, email, ...note }) => ({
    ...note,
    author: name || username || email,
  }))
}

export async function createBookNote(
  bookUuid: UUID,
  userId: UUID,
  body: string,
) {
  const { uuid } = await db
    .insertInto("bookNote")
    .values({ bookUuid, userId, body })
    .returning("uuid")
    .executeTakeFirstOrThrow()
  return getBookNote(uuid)
}

export async function getBookNote(uuid: UUID) {
  const row = await db
    .selectFrom("bookNote")
    .selectAll()
    .where("uuid", "=", uuid)
    .executeTakeFirst()
  return row ?? null
}

/** Changes a note's text. Returns false when it is not this user's note. */
export async function updateBookNote(
  uuid: UUID,
  userId: UUID,
  body: string,
): Promise<boolean> {
  const result = await db
    .updateTable("bookNote")
    .set({ body })
    .where("uuid", "=", uuid)
    .where("userId", "=", userId)
    .executeTakeFirst()
  return Number(result.numUpdatedRows) > 0
}

/** Deletes a note. Returns false when it is not this user's note. */
export async function deleteBookNote(
  uuid: UUID,
  userId: UUID,
): Promise<boolean> {
  const result = await db
    .deleteFrom("bookNote")
    .where("uuid", "=", uuid)
    .where("userId", "=", userId)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}
