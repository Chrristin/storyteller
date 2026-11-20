import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { undoTitleCleanup } from "@/database/titleCleanup"

export const dynamic = "force-dynamic"

let running = false

/**
 * @summary Undo the last title clean-up
 *
 * Body `{ batchId?: string }`, default the latest run. Puts the old titles
 * back, only for books whose title is still the one the clean-up wrote. Answers
 * `{ batchId, restored, skipped, errors }`.
 */
export const POST = withHasPermission("bookUpdate")(async (request) => {
  const body = (await request.json().catch(() => ({}))) as {
    batchId?: unknown
  } | null
  const batchId = typeof body?.batchId === "string" ? body.batchId : undefined

  if (running) {
    return NextResponse.json(
      { message: "A title clean-up is already running" },
      { status: 409 },
    )
  }
  running = true
  try {
    return NextResponse.json(await undoTitleCleanup(batchId))
  } finally {
    running = false
  }
})
