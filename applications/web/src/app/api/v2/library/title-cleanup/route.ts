import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  getLastTitleCleanupBatch,
  previewTitleCleanupPage,
} from "@/database/titleCleanup"

export const dynamic = "force-dynamic"

/**
 * @summary Preview the title clean-up
 *
 * Read only. Lists the books whose title would change, as `{ bookUuid,
 * oldTitle, newTitle, reason }`, one page at a time (`offset`, `limit`, default
 * 50), with the `total` and the last clean-up that can still be undone.
 */
export const GET = withHasPermission("bookUpdate")(async (request) => {
  const params = new URL(request.url).searchParams
  const offset = Math.max(
    0,
    Number.parseInt(params.get("offset") ?? "0", 10) || 0,
  )
  const rawLimit = Number.parseInt(params.get("limit") ?? "50", 10)
  const limit = Math.min(
    500,
    Math.max(0, Number.isNaN(rawLimit) ? 50 : rawLimit),
  )
  // limit=0 skips the scan and only reports the last clean-up that can be undone.
  const [page, lastBatch] = await Promise.all([
    limit === 0
      ? Promise.resolve({ total: 0, items: [] })
      : previewTitleCleanupPage(offset, limit),
    getLastTitleCleanupBatch(),
  ])
  return NextResponse.json({ ...page, lastBatch })
})
