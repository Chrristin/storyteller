import { NextResponse } from "next/server"

import { withUser } from "@/auth/auth"
import {
  MAX_NOTE_LENGTH,
  deleteBookNote,
  updateBookNote,
} from "@/database/bookNotes"
import { type UUID } from "@/uuid"

type Params = Promise<{ bookId: UUID; noteId: UUID }>

/**
 * @summary Change one of your own notes
 */
export const PUT = withUser<Params>(async (request, context) => {
  const { noteId } = await context.params
  const { body } = (await request.json()) as { body?: unknown }
  const text = typeof body === "string" ? body.trim() : ""
  if (!text || text.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { message: `A note must be between 1 and ${MAX_NOTE_LENGTH} characters` },
      { status: 405 },
    )
  }

  const updated = await updateBookNote(noteId, request.auth.user.id, text)
  // Someone else's note is reported as missing, not as forbidden.
  if (!updated) return new Response(null, { status: 404 })
  return new Response(null, { status: 204 })
})

/**
 * @summary Delete one of your own notes
 */
export const DELETE = withUser<Params>(async (request, context) => {
  const { noteId } = await context.params
  const deleted = await deleteBookNote(noteId, request.auth.user.id)
  if (!deleted) return new Response(null, { status: 404 })
  return new Response(null, { status: 204 })
})
