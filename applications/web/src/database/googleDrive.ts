import { randomBytes } from "node:crypto"

import { decryptSecret, encryptSecret } from "@/secrets"
import { type UUID } from "@/uuid"

import { db } from "./connection"

const CLIENT_SECRET_LABEL = "googleDriveClientSecret"
const REFRESH_TOKEN_LABEL = "googleDriveRefreshToken"
const STATE_MAX_AGE_MS = 10 * 60 * 1000

/**
 * Google Drive sync is per user. The server owner saves one Google OAuth client
 * (the client id and secret). Each user then signs in with their own Google
 * account, and has their own folder and their own record of copied books.
 */

export type GoogleDriveStatus = {
  /** The owner has saved a Google OAuth client, so users can connect. */
  configured: boolean
  /** This user has signed in to Google and a refresh token is saved. */
  connected: boolean
  accountEmail: string | null
}

export type GoogleDriveClient = { clientId: string; clientSecret: string }

export type GoogleDriveCredentials = GoogleDriveClient & {
  refreshToken: string | null
  folderId: string | null
  accountEmail: string | null
}

async function getClientRow() {
  return (
    (await db
      .selectFrom("googleDriveConfig")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst()) ?? null
  )
}

async function getConnectionRow(userId: UUID) {
  return (
    (await db
      .selectFrom("googleDriveConnection")
      .selectAll()
      .where("userId", "=", userId)
      .executeTakeFirst()) ?? null
  )
}

/** The owner's client id, for the owner's settings screen. Never the secret. */
export async function getGoogleDriveClientId() {
  return (await getClientRow())?.clientId ?? null
}

export async function getGoogleDriveStatus(
  userId: UUID,
): Promise<GoogleDriveStatus> {
  const [client, connection] = await Promise.all([
    getClientRow(),
    getConnectionRow(userId),
  ])
  return {
    configured: !!client?.clientId && !!client.clientSecret,
    connected: !!connection?.refreshToken,
    accountEmail: connection?.accountEmail ?? null,
  }
}

async function getClient(): Promise<GoogleDriveClient | null> {
  const row = await getClientRow()
  if (!row?.clientId || !row.clientSecret) return null

  const clientSecret = await decryptSecret(
    row.clientSecret,
    CLIENT_SECRET_LABEL,
  )
  if (!clientSecret) return null
  return { clientId: row.clientId, clientSecret }
}

/** The client plus this user's own sign-in, ready to use. */
export async function getGoogleDriveCredentials(
  userId: UUID,
): Promise<GoogleDriveCredentials | null> {
  const client = await getClient()
  if (!client) return null

  const connection = await getConnectionRow(userId)
  const refreshToken = connection?.refreshToken
    ? await decryptSecret(connection.refreshToken, REFRESH_TOKEN_LABEL)
    : null

  return {
    ...client,
    refreshToken,
    folderId: connection?.folderId ?? null,
    accountEmail: connection?.accountEmail ?? null,
  }
}

/** The client alone, for starting a sign-in before the user has a token. */
export async function getGoogleDriveClient() {
  return await getClient()
}

/**
 * Saves the owner's Google OAuth client. Replacing the client invalidates every
 * user's sign-in, because a refresh token only works with the client that issued
 * it, so the users' connections are cleared too.
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
        updatedAt: new Date().toISOString(),
      }),
    )
    .execute()
  await db.deleteFrom("googleDriveConnection").execute()
  await db.deleteFrom("bookDriveFile").execute()
}

/** Starts a sign-in: remembers a one-time state value and where Google returns to. */
export async function beginGoogleDriveSignIn(
  userId: UUID,
  redirectUri: string,
) {
  const state = randomBytes(24).toString("hex")
  const values = {
    oauthState: state,
    oauthRedirectUri: redirectUri,
    oauthStateAt: new Date().toISOString(),
  }
  await db
    .insertInto("googleDriveConnection")
    .values({ userId, ...values })
    .onConflict((oc) => oc.column("userId").doUpdateSet(values))
    .execute()
  return state
}

/**
 * Checks the state Google sent back. The state belongs to the user who started
 * the sign-in, is single use, and expires, so it is cleared whether or not it
 * matches.
 */
export async function takeGoogleDriveSignIn(
  userId: UUID,
  state: string,
): Promise<{ redirectUri: string } | null> {
  const row = await getConnectionRow(userId)
  await db
    .updateTable("googleDriveConnection")
    .set({ oauthState: null, oauthRedirectUri: null, oauthStateAt: null })
    .where("userId", "=", userId)
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
  userId: UUID,
  refreshToken: string,
  accountEmail: string | null,
) {
  const values = {
    refreshToken: await encryptSecret(refreshToken),
    accountEmail,
    folderId: null,
    updatedAt: new Date().toISOString(),
  }
  await db
    .insertInto("googleDriveConnection")
    .values({ userId, ...values })
    .onConflict((oc) => oc.column("userId").doUpdateSet(values))
    .execute()
}

export async function saveGoogleDriveFolderId(userId: UUID, folderId: string) {
  await db
    .updateTable("googleDriveConnection")
    .set({ folderId, updatedAt: new Date().toISOString() })
    .where("userId", "=", userId)
    .execute()
}

/** Forgets this user's sign-in and their record of copied books. */
export async function disconnectGoogleDrive(userId: UUID) {
  await db
    .deleteFrom("googleDriveConnection")
    .where("userId", "=", userId)
    .execute()
  await db.deleteFrom("bookDriveFile").where("userId", "=", userId).execute()
}

/** Removes the saved OAuth client and everyone's sign-in. */
export async function removeGoogleDrive() {
  await db.deleteFrom("googleDriveConfig").execute()
  await db.deleteFrom("googleDriveConnection").execute()
  await db.deleteFrom("bookDriveFile").execute()
}

export type BookDriveRecord = {
  driveFileId: string
  fileName: string
  syncedAt: string
}

export async function getBookDriveFiles(
  userId: UUID,
  bookUuids: UUID[],
): Promise<Map<UUID, BookDriveRecord>> {
  if (bookUuids.length === 0) return new Map()
  const rows = await db
    .selectFrom("bookDriveFile")
    .selectAll()
    .where("userId", "=", userId)
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
  userId: UUID,
  bookUuid: UUID,
  driveFileId: string,
  fileName: string,
) {
  const syncedAt = new Date().toISOString()
  await db
    .insertInto("bookDriveFile")
    .values({ userId, bookUuid, driveFileId, fileName, syncedAt })
    .onConflict((oc) =>
      oc
        .columns(["userId", "bookUuid"])
        .doUpdateSet({ driveFileId, fileName, syncedAt }),
    )
    .execute()
}

export async function forgetBookDriveFile(userId: UUID, bookUuid: UUID) {
  await db
    .deleteFrom("bookDriveFile")
    .where("userId", "=", userId)
    .where("bookUuid", "=", bookUuid)
    .execute()
}
