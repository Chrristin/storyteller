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
import { type UUID } from "@/uuid"

/**
 * A ready-to-use Drive connection for one user: a fresh access token and the
 * folder that user's books go into. Throws a DriveError saying what has to be
 * done when Drive is not set up or the user's sign-in has to be redone.
 */
export async function openDriveSession(userId: UUID, fetchFn: FetchFn = fetch) {
  const credentials = await getGoogleDriveCredentials(userId)
  if (!credentials) {
    throw new DriveError(
      "reauth-needed",
      "Google Drive is not set up on this server. The owner has to add the Google client in Settings first.",
    )
  }
  if (!credentials.refreshToken) {
    throw new DriveError(
      "reauth-needed",
      "Google Drive is not connected for your account. Connect it in Preferences.",
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
    await saveGoogleDriveFolderId(userId, folderId)
  }

  return { accessToken, folderId }
}
