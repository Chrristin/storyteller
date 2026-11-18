import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getHardcoverIdentifyStatus } from "@/hardcover/status"

export const dynamic = "force-dynamic"

/**
 * @summary Whether Identify with Hardcover is ready and how far it has got
 *
 * `configured` only says a Hardcover token is saved; the token is never
 * returned. The token itself is saved with PUT /api/v2/metadata/providers.
 */
export const GET = withHasPermission(["settingsUpdate", "bookUpdate"])(
  async () => {
    return NextResponse.json(await getHardcoverIdentifyStatus())
  },
)
