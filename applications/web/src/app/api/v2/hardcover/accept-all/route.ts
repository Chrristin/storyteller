import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { acceptAllSure } from "@/hardcover/apply"

export const dynamic = "force-dynamic"

let running = false

/**
 * @summary Apply every "sure" Hardcover suggestion
 *
 * Adds each book to its suggested series (reusing a library series with the
 * same normalised name) and adds genres as tags. Never removes a series or tag,
 * never changes authors. "Check this one" matches are not applied. Answers
 * `{ seriesAdded, tagsAdded, skipped, accepted }`.
 */
export const POST = withHasPermission("bookUpdate")(async (request) => {
  if (running) {
    return NextResponse.json(
      { message: "Accept all is already running" },
      { status: 409 },
    )
  }
  running = true
  try {
    return NextResponse.json(await acceptAllSure(request.auth.user.id))
  } finally {
    running = false
  }
})
