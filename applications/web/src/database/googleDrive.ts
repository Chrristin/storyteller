import { randomBytes } from "node:crypto"

import { decryptSecret, encryptSecret } from "@/secrets"
import { type UUID } from "@/uuid"

import { db } from "./connection"

const CLIENT_SECRET_LABEL = "googleDriveClientSecret"
const REFRESH_TOKEN_LABEL = "googleDriveRefreshToken"
const STATE_MAX_AGE_MS = 10 * 60 * 1000

export type GoogleDriveStatus = {
  /** A Google OAuth client id and secret have been saved. */
  configured: boolean
  /** The owner has signed in to Google and a refresh token is saved. */
  connected: boolean
  accountEmail: string | null
  clientId: string | null
}

export type GoogleDriveCredentials = {
  clientId: string
  clientSecret: string
  refreshToken: string | null
  folderId: string | null
  accountEmail: string | null
}

async function getRow() {
  return (
    (await db
      .selectFrom("googleDriveConfig")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst()) ?? null
  )
}

export async function getGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  const row = await getRow()
  return {
    configured: !!row?.clientId && !!row.clientSecret,
    connected: !!row?.refreshToken,
    accountEmail: row?.accountEmail ?? null,
    clientId: row?.clientId ?? null,
  }
}

export async function getGoogleDriveCredentials(): Promise<GoogleDriveCredentials | null> {
  const row = await getRow()
  if (!row?.clientId || !row.clientSecret) return null

  const clientSecret = await decryptSecret(
    row.clientSecret,
    CLIENT_SECRET_LABEL,
  )
  if (!clientSecret) return null

  const refreshToken = row.refreshToken
    ? await decryptSecret(row.refreshToken, REFRESH_TOKEN_LABEL)
    : null

  return {
    clientId: row.clientId,
    clientSecret,
    refreshToken,
    folderId: row.folderId,
    accountEmail: row.accountEmail,
  }
}

/**
 * Saves the owner's Google OAuth client. Replacing the client invalidates any
 * earlier sign-in, because a refresh token only works with the client that
 * issued it.
 */
export async function saveGoogleDriveClient(
  clientId: string,
  clientSecret: string,
) {
  const encrypted = await encryptSecret(clientSecret)
  await db
    .insertInto("googleDriveConfig")
    .values({ id: 1, clientId, clientSecret: encrypted })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        clientId,
        clientSecret: encrypted,
        refreshToken: null,
        accountEmail: null,
        folderId: null,
        oauthState: null,
        oauthRedirectUri: null,
        oauthStateAt: null,
        updatedAt: new Date().toISOString(),
      }),
    )
    .execute()
}

/** Starts a sign-in: remembers a one-time state value and where Google returns to. */
export async function beginGoogleDriveSignIn(redirectUri: string) {
  const state = randomBytes(24).toString("hex")
  await db
    .updateTable("googleDriveConfig")
    .set({
      oauthState: state,
      oauthRedirectUri: redirectUri,
      oauthStateAt: new Date().toISOString(),
    })
    .where("id", "=", 1)
    .execute()
  return state
}

/**
 * Checks the state Google sent back. The state is single use and expires, so
 * it is cleared whether or not it matches.
 */
export async function takeGoogleDriveSignIn(
  state: string,
): Promise<{ redirectUri: string } | null> {
  const row = await getRow()
  await db
    .updateTable("googleDriveConfig")
    .set({ oauthState: null, oauthRedirectUri: null, oauthStateAt: null })
    .where("id", "=", 1)
    .execute()

  if (!row?.oauthState || !row.oauthRedirectUri || !row.oauthStateAt) {
    return null
  }
  if (row.oauthState !== state) return null
  const age = Date.now() - new Date(row.oauthStateAt).getTime()
  if (!(age >= 0 && age <= STATE_MAX_AGE_MS)) return null

  return { redirectUri: row.oauthRedirectUri }
}

export async function saveGoogleDriveSignIn(
  refreshToken: string,
  accountEmail: string | null,
) {
  await db
    .updateTable("googleDriveConfig")
    .set({
      refreshToken: await encryptSecret(refreshToken),
      accountEmail,
      folderId: null,
      updatedAt: new Date().toISOString(),
    })
    .where("id", "=", 1)
    .execute()
}

export async function saveGoogleDriveFolderId(folderId: string) {
  await db
    .updateTable("googleDriveConfig")
    .set({ folderId, updatedAt: new Date().toISOString() })
    .where("id", "=", 1)
    .execute()
}

/** Forgets the sign-in and the synced-file record, but keeps the OAuth client. */
export async function disconnectGoogleDrive() {
  await db
    .updateTable("googleDriveConfig")
    .set({
      refreshToken: null,
      accountEmail: null,
      folderId: null,
      oauthState: null,
      oauthRedirectUri: null,
      oauthStateAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where("id", "=", 1)
    .execute()
  await db.deleteFrom("bookDriveFile").execute()
}

/** Removes everything, including the saved OAuth client. */
export async function removeGoogleDrive() {
  await db.deleteFrom("googleDriveConfig").execute()
  await db.deleteFrom("bookDriveFile").execute()
}

export type BookDriveRecord = {
  driveFileId: string
  fileName: string
  syncedAt: string
}

export async function getBookDriveFiles(
  bookUuids: UUID[],
): Promise<Map<UUID, BookDriveRecord>> {
  if (bookUuids.length === 0) return new Map()
  const rows = await db
    .selectFrom("bookDriveFile")
    .selectAll()
    .where("bookUuid", "in", bookUuids)
    .execute()
  return new Map(
    rows.map((row) => [
      row.bookUuid,
      {
        driveFileId: row.driveFileId,
        fileName: row.fileName,
        syncedAt: row.syncedAt,
      },
    ]),
  )
}

export async function recordBookDriveFile(
  bookUuid: UUID,
  driveFileId: string,
  fileName: string,
) {
  const syncedAt = new Date().toISOString()
  await db
    .insertInto("bookDriveFile")
    .values({ bookUuid, driveFileId, fileName, syncedAt })
    .onConflict((oc) =>
      oc.column("bookUuid").doUpdateSet({ driveFileId, fileName, syncedAt }),
    )
    .execute()
}

export async function forgetBookDriveFile(bookUuid: UUID) {
  await db
    .deleteFrom("bookDriveFile")
    .where("bookUuid", "=", bookUuid)
    .execute()
}
