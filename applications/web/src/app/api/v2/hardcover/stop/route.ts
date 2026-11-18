import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { stopIdentify } from "@/hardcover/identifyJob"

export const dynamic = "force-dynamic"

/** @summary Stop the Hardcover lookup after the current book (server owner only) */
export const POST = withHasPermission("settingsUpdate")(async () => {
  stopIdentify()
  return NextResponse.json({ stopping: true })
})
