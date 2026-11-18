import { NextResponse } from "next/server"
import { z } from "zod"

import { withHasPermission } from "@/auth/auth"
import { readHardcoverToken } from "@/database/providerTokens"
import { startIdentify } from "@/hardcover/identifyJob"

export const dynamic = "force-dynamic"

const RunSchema = z.object({ mode: z.enum(["new", "all"]) })

/**
 * @summary Start looking books up on Hardcover (server owner only)
 *
 * `new` checks books that have not been looked at yet (or failed last time).
 * `all` first resets every suggestion that has not been accepted, then checks
 * everything again. Only the title and first author of each book are sent.
 * Answers 409 when a run is already going.
 */
export const POST = withHasPermission("settingsUpdate")(async (request) => {
  const parsed = RunSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { message: "mode must be 'new' or 'all'" },
      { status: 400 },
    )
  }
  const { status } = await readHardcoverToken()
  if (!status.tokenSet) {
    return NextResponse.json(
      { message: "Add a Hardcover token in Settings, Metadata first" },
      { status: 400 },
    )
  }
  const { started } = startIdentify(parsed.data.mode)
  if (!started) {
    return NextResponse.json(
      { message: "A run is already going" },
      { status: 409 },
    )
  }
  return NextResponse.json({ started: true }, { status: 202 })
})
