import { NextResponse } from "next/server"
import { z } from "zod"

import { withHasPermission } from "@/auth/auth"
import {
  getGoogleDriveClientId,
  removeGoogleDrive,
  saveGoogleDriveClient,
} from "@/database/googleDrive"

export const dynamic = "force-dynamic"

/**
 * @summary The saved Google client id (server owner only)
 *
 * Never includes the client secret.
 */
export const GET = withHasPermission("settingsUpdate")(async () => {
  return NextResponse.json({ clientId: await getGoogleDriveClientId() })
})

const ClientSchema = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
})

/**
 * @summary Save the Google OAuth client id and secret (server owner only)
 *
 * Saving a client forgets every user's Google sign-in, because a sign-in only
 * works with the client that issued it.
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
 * @summary Remove the Google client and every user's sign-in (server owner only)
 *
 * Nothing is deleted in anyone's Google Drive.
 */
export const DELETE = withHasPermission("settingsUpdate")(async () => {
  await removeGoogleDrive()
  return NextResponse.json({ removed: true })
})
