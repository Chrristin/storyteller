import { NextResponse } from "next/server"
import { z } from "zod"

import { withHasPermission } from "@/auth/auth"
import {
  disconnectGoogleDrive,
  getGoogleDriveStatus,
  removeGoogleDrive,
  saveGoogleDriveClient,
} from "@/database/googleDrive"

export const dynamic = "force-dynamic"

/**
 * @summary Whether Google Drive sync is set up and connected
 *
 * Never includes the client secret or the sign-in token.
 */
export const GET = withHasPermission("bookDownload")(async () => {
  const { configured, connected, accountEmail } = await getGoogleDriveStatus()
  return NextResponse.json({ configured, connected, accountEmail })
})

const ClientSchema = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
})

/**
 * @summary Save the Google OAuth client id and secret (server owner only)
 *
 * Saving a new client forgets any earlier Google sign-in.
 */
export const PUT = withHasPermission("settingsUpdate")(async (request) => {
  const parsed = ClientSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { message: "A client id and a client secret are required" },
      { status: 400 },
    )
  }
  await saveGoogleDriveClient(parsed.data.clientId, parsed.data.clientSecret)
  return NextResponse.json({ saved: true })
})

/**
 * @summary Disconnect Google Drive (server owner only)
 *
 * Forgets the sign-in. Add `?all=true` to forget the client id and secret too.
 * Nothing is deleted in Google Drive.
 */
export const DELETE = withHasPermission("settingsUpdate")(async (request) => {
  const all = new URL(request.url).searchParams.get("all") === "true"
  if (all) {
    await removeGoogleDrive()
  } else {
    await disconnectGoogleDrive()
  }
  return NextResponse.json({ disconnected: true })
})
