import { NextResponse } from "next/server"
import { z } from "zod"

import { withHasPermission } from "@/auth/auth"
import { listReview } from "@/database/hardcoverIdentity"

export const dynamic = "force-dynamic"

const QuerySchema = z.object({
  status: z.enum(["sure", "check", "none", "accepted"]),
  cursor: z.string().optional(),
})

/**
 * @summary Hardcover suggestions for the books the user can see
 *
 * `status` is sure (waiting for Accept all), check, none (not found) or
 * accepted. Paged: pass the returned `nextCursor` as `cursor` for more.
 */
export const GET = withHasPermission("bookUpdate")(async (request) => {
  const params = new URL(request.url).searchParams
  const parsed = QuerySchema.safeParse({
    status: params.get("status") ?? undefined,
    cursor: params.get("cursor") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { message: "status must be sure, check, none or accepted" },
      { status: 400 },
    )
  }
  return NextResponse.json(
    await listReview(parsed.data.status, {
      cursor: parsed.data.cursor ?? null,
      userId: request.auth.user.id,
    }),
  )
})
