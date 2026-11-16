import { NextResponse } from "next/server"

import { withHasPermission, withUser } from "@/auth/auth"
import {
  MAX_NOTE_LENGTH,
  createBookNote,
  listBookNotes,
} from "@/database/bookNotes"
import { getBook } from "@/database/books"
import { type UUID } from "@/uuid"

type Params = Promise<{ bookId: UUID }>

/**
 * @summary List the notes on a book, written by anyone who can see it
 */
export const GET = withUser<Params>(async (request, context) => {
  const { bookId } = await context.params
  const book = await getBook(bookId, request.auth.user.id)
  if (!book) return new Response(null, { status: 404 })
  return NextResponse.json(await listBookNotes(bookId, request.auth.user.id))
})

/**
 * @summary Add a note to a book as the current user
 *
 * Writing needs a full sign-in ("manageSelf"), like ratings: a reading-only
 * API token can list notes but not add, change or delete them.
 */
export const POST = withHasPermission<Params>("manageSelf")(async (
  request,
  context,
) => {
  const { bookId } = await context.params
  const book = await getBook(bookId, request.auth.user.id)
  if (!book) return new Response(null, { status: 404 })

  const { body } = (await request.json()) as { body?: unknown }
  const text = typeof body === "string" ? body.trim() : ""
  if (!text || text.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { message: `A note must be between 1 and ${MAX_NOTE_LENGTH} characters` },
      { status: 405 },
    )
  }

  const note = await createBookNote(bookId, request.auth.user.id, text)
  return NextResponse.json(note, { status: 201 })
})
