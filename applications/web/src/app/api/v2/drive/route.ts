import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  disconnectGoogleDrive,
  getGoogleDriveStatus,
} from "@/database/googleDrive"

export const dynamic = "force-dynamic"

/**
 * @summary Whether Google Drive sync is set up, and connected for this user
 *
 * `configured` means the server owner saved a Google client, so users can
 * connect. `connected` and `accountEmail` are about the signed-in user's own
 * Google account. Never includes any secret or token.
 */
export const GET = withHasPermission("bookDownload")(async (request) => {
  return NextResponse.json(await getGoogleDriveStatus(request.auth.user.id))
})

/**
 * @summary Disconnect Google Drive for the current user
 *
 * Forgets this user's Google sign-in and their record of copied books. Nothing
 * is deleted in Google Drive.
 */
export const DELETE = withHasPermission("manageSelf")(async (request) => {
  await disconnectGoogleDrive(request.auth.user.id)
  return NextResponse.json({ disconnected: true })
})
