import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { applyTitleCleanup } from "@/database/titleCleanup"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

let running = false

/**
 * @summary Apply the title clean-up
 *
 * Body `{ bookUuids?: string[] }`. With no list, every previewed title is
 * changed. The old titles are saved first so the run can be undone. Each title
 * is saved like a normal title edit, which also queues the write of the new
 * title into the book's epub and audio files. Answers `{ batchId, applied,
 * skipped, errors }`.
 */
export const POST = withHasPermission("bookUpdate")(async (request) => {
  const body = (await request.json().catch(() => ({}))) as {
    bookUuids?: unknown
  } | null
  const bookUuids = Array.isArray(body?.bookUuids)
    ? body.bookUuids.filter((id): id is UUID => typeof id === "string")
    : undefined

  if (running) {
    return NextResponse.json(
      { message: "A title clean-up is already running" },
      { status: 409 },
    )
  }
  running = true
  try {
    return NextResponse.json(await applyTitleCleanup(bookUuids))
  } finally {
    running = false
  }
})
