import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  getGoogleDriveCredentials,
  saveGoogleDriveSignIn,
  takeGoogleDriveSignIn,
} from "@/database/googleDrive"
import { exchangeCode, getAccountEmail } from "@/googleDrive"
import { logger } from "@/logging"

export const dynamic = "force-dynamic"

function back(redirectOrigin: string, result: string) {
  return NextResponse.redirect(
    `${redirectOrigin}/settings?tab=server&section=googleDrive&drive=${encodeURIComponent(result)}`,
  )
}

/**
 * @summary Where Google sends the browser after the owner signs in
 *
 * Checks the one-time state, trades the code for a refresh token, and stores it
 * encrypted. Then sends the owner back to the settings page.
 */
export const GET = withHasPermission("settingsUpdate")(async (request) => {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const googleError = url.searchParams.get("error")

  const pending = state ? await takeGoogleDriveSignIn(state) : null
  if (!pending) {
    return back(url.origin, "invalid-state")
  }
  const origin = new URL(pending.redirectUri).origin

  if (googleError || !code) {
    return back(origin, googleError === "access_denied" ? "denied" : "failed")
  }

  const credentials = await getGoogleDriveCredentials()
  if (!credentials) return back(origin, "failed")

  try {
    const tokens = await exchangeCode(credentials, code, pending.redirectUri)
    if (!tokens.refresh_token) {
      return back(origin, "no-refresh-token")
    }
    const email = await getAccountEmail(tokens.access_token).catch(() => null)
    await saveGoogleDriveSignIn(tokens.refresh_token, email)
  } catch (error) {
    logger.error({ msg: "Google Drive sign-in failed", err: error })
    return back(origin, "failed")
  }

  return back(origin, "connected")
})
