import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  beginGoogleDriveSignIn,
  getGoogleDriveCredentials,
} from "@/database/googleDrive"
import { buildAuthUrl } from "@/googleDrive"

export const dynamic = "force-dynamic"

export const DRIVE_CALLBACK_PATH = "/api/v2/drive/callback"

/**
 * @summary Start the Google sign-in (server owner only)
 *
 * Returns the Google address to send the browser to. `origin` is the address
 * the owner uses to reach this server, for example https://books.example.com.
 * Google sends the browser back to `<origin>/api/v2/drive/callback`, which must
 * be listed as an authorised redirect URI on the owner's Google client.
 */
export const POST = withHasPermission("settingsUpdate")(async (request) => {
  const credentials = await getGoogleDriveCredentials()
  if (!credentials) {
    return NextResponse.json(
      { message: "Save the Google client id and secret first" },
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
  const state = await beginGoogleDriveSignIn(redirectUri)
  return NextResponse.json({
    url: buildAuthUrl(credentials, redirectUri, state),
    redirectUri,
  })
})
