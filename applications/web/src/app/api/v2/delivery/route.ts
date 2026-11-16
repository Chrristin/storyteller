import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getGoogleDriveStatus } from "@/database/googleDrive"
import { getSettings } from "@/database/settings"
import { resolveUserPreferences } from "@/database/userPreferencesTypes"
import { getUserSettings } from "@/database/userSettings"
import { defaultKindleAddress } from "@/kindle"

export const dynamic = "force-dynamic"

/**
 * @summary Ways the current user can send ebooks somewhere else
 *
 * One call for the apps to decide which buttons to show:
 * - `drive`: whether Google Drive sync is set up on this server, and whether
 *   this user has connected their own Google account.
 * - `kindle`: whether the server can send email, and whether this user saved a
 *   Kindle address. Send to Kindle works only when both are true.
 *
 * Everything here is about the signed-in user. Nothing secret is included.
 */
export const GET = withHasPermission("bookDownload")(async (request) => {
  const userId = request.auth.user.id
  const [drive, { smtpHost }, rawSettings] = await Promise.all([
    getGoogleDriveStatus(userId),
    getSettings(),
    getUserSettings(userId),
  ])
  const { kindleAddresses } = resolveUserPreferences(rawSettings)
  const defaultAddress = defaultKindleAddress(kindleAddresses)

  return NextResponse.json({
    drive,
    kindle: {
      smtpConfigured: !!smtpHost,
      hasAddress: kindleAddresses.length > 0,
      defaultAddress: defaultAddress?.email ?? null,
      available: !!smtpHost && kindleAddresses.length > 0,
    },
  })
})
