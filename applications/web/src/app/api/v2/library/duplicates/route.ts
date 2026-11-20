import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { previewDuplicates } from "@/database/duplicates"

export const dynamic = "force-dynamic"

/**
 * @summary Find duplicate books
 * @desc Groups books that have the same title and author in the same format.
 *       Reads only: nothing is archived or changed. Use `offset` and `limit`
 *       to page through the groups. Each group names the book that would be
 *       kept (the largest file, then the newest).
 */
export const GET = withHasPermission("bookUpdate")(async (request) => {
  const params = request.nextUrl.searchParams
  const offset = Math.max(0, parseInt(params.get("offset") ?? "0") || 0)
  const limit = Math.min(
    500,
    Math.max(1, parseInt(params.get("limit") ?? "50") || 50),
  )

  return NextResponse.json(await previewDuplicates({ offset, limit }))
})
