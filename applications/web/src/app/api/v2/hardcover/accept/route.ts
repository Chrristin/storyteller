import { NextResponse } from "next/server"
import { z } from "zod"

import { withHasPermission } from "@/auth/auth"
import { acceptSelected } from "@/hardcover/apply"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

const BodySchema = z.object({
  bookUuids: z.array(z.string().min(1)).min(1).max(2000),
})

let running = false

/**
 * @summary Apply the chosen Hardcover suggestions
 *
 * Body `{ bookUuids: string[] }`. Applies those books exactly like Accept all
 * does, but also for "Check this one" rows: the book is added to the suggested
 * series and its genres are added as tags, then it is marked accepted. Only
 * books whose suggestion is currently "check" or "sure" are used, others are
 * ignored. Answers `{ seriesAdded, tagsAdded, skipped, accepted }`.
 */
export const POST = withHasPermission("bookUpdate")(async (request) => {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Send bookUuids, a list of book ids" },
      { status: 400 },
    )
  }
  if (running) {
    return NextResponse.json(
      { message: "An accept is already running" },
      { status: 409 },
    )
  }
  running = true
  try {
    return NextResponse.json(
      await acceptSelected(
        [...new Set(parsed.data.bookUuids)] as UUID[],
        request.auth.user.id,
      ),
    )
  } finally {
    running = false
  }
})
