import {
  getGoogleDriveCredentials,
  saveGoogleDriveFolderId,
} from "@/database/googleDrive"
import {
  DriveError,
  type FetchFn,
  refreshAccessToken,
  resolveSyncFolder,
} from "@/googleDrive"

/**
 * A ready-to-use Drive connection: a fresh access token and the folder books
 * go into. Throws a DriveError saying what the owner has to do when Drive is
 * not set up or the sign-in has to be redone.
 */
export async function openDriveSession(fetchFn: FetchFn = fetch) {
  const credentials = await getGoogleDriveCredentials()
  if (!credentials) {
    throw new DriveError(
      "reauth-needed",
      "Google Drive is not set up. Add the Google client in Settings first.",
    )
  }
  if (!credentials.refreshToken) {
    throw new DriveError(
      "reauth-needed",
      "Google Drive is not connected. Connect it in Settings.",
    )
  }

  const accessToken = await refreshAccessToken(
    credentials,
    credentials.refreshToken,
    fetchFn,
  )
  const folderId = await resolveSyncFolder(
    credentials.folderId,
    accessToken,
    fetchFn,
  )
  if (folderId !== credentials.folderId) {
    await saveGoogleDriveFolderId(folderId)
  }

  return { accessToken, folderId }
}
