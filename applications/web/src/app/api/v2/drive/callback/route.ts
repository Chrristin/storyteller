import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  getGoogleDriveClient,
  saveGoogleDriveSignIn,
  takeGoogleDriveSignIn,
} from "@/database/googleDrive"
import { exchangeCode, getAccountEmail } from "@/googleDrive"
import { logger } from "@/logging"

export const dynamic = "force-dynamic"

function back(redirectOrigin: string, result: string) {
  return NextResponse.redirect(
    `${redirectOrigin}/preferences?tab=devices&section=googleDrive&drive=${encodeURIComponent(result)}`,
  )
}

/**
 * @summary Where Google sends the browser after a user signs in
 *
 * Checks the one-time state (which belongs to the user who started the sign-in),
 * trades the code for a refresh token, and stores it encrypted for that user.
 * Then sends the user back to their preferences page.
 */
export const GET = withHasPermission("manageSelf")(async (request) => {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const googleError = url.searchParams.get("error")
  const userId = request.auth.user.id

  const pending = state ? await takeGoogleDriveSignIn(userId, state) : null
  if (!pending) {
    return back(url.origin, "invalid-state")
  }
  const origin = new URL(pending.redirectUri).origin

  if (googleError || !code) {
    return back(origin, googleError === "access_denied" ? "denied" : "failed")
  }

  const client = await getGoogleDriveClient()
  if (!client) return back(origin, "failed")

  try {
    const tokens = await exchangeCode(client, code, pending.redirectUri)
    if (!tokens.refresh_token) {
      return back(origin, "no-refresh-token")
    }
    const email = await getAccountEmail(tokens.access_token).catch(() => null)
    await saveGoogleDriveSignIn(userId, tokens.refresh_token, email)
  } catch (error) {
    logger.error({ msg: "Google Drive sign-in failed", err: error })
    return back(origin, "failed")
  }

  return back(origin, "connected")
})
