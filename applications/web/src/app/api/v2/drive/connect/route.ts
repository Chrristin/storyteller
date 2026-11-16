import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  beginGoogleDriveSignIn,
  getGoogleDriveClient,
} from "@/database/googleDrive"
import { buildAuthUrl } from "@/googleDrive"

export const dynamic = "force-dynamic"

export const DRIVE_CALLBACK_PATH = "/api/v2/drive/callback"

/**
 * @summary Start the Google sign-in for the current user
 *
 * Returns the Google address to send the browser to. `origin` is the address
 * used to reach this server, for example https://books.example.com. Google
 * sends the browser back to `<origin>/api/v2/drive/callback`, which must be
 * listed as an authorised redirect URI on the owner's Google client.
 */
export const POST = withHasPermission("manageSelf")(async (request) => {
  const client = await getGoogleDriveClient()
  if (!client) {
    return NextResponse.json(
      {
        code: "not-configured",
        message: "The server owner has not set up Google Drive yet",
      },
      { status: 409 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as { origin?: unknown }
  let origin: string
  try {
    origin = new URL(
      typeof body.origin === "string" ? body.origin : request.url,
    ).origin
  } catch {
    return NextResponse.json({ message: "Invalid origin" }, { status: 400 })
  }

  const redirectUri = `${origin}${DRIVE_CALLBACK_PATH}`
  const state = await beginGoogleDriveSignIn(request.auth.user.id, redirectUri)
  return NextResponse.json({
    url: buildAuthUrl(client, redirectUri, state),
    redirectUri,
  })
})
