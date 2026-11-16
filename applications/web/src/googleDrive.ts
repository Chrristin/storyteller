import { readFile } from "node:fs/promises"

import { safeFilename } from "@/assets/bookArchive"
import { type UUID } from "@/uuid"

/**
 * Copies ebooks into a Google Drive folder, so a Kobo (or any reader that syncs
 * a Drive folder) can pick them up.
 *
 * It talks to Google's REST API with plain `fetch`, using the owner's own OAuth
 * client (see src/database/googleDrive.ts). It needs the full Drive scope,
 * because the Kobo's "Rakuten Kobo" folder is created by Kobo, not by this app,
 * and a narrower scope could not see or write into it. The code only ever
 * creates one folder (a subfolder of "Rakuten Kobo") and uploads into it. It
 * never deletes anything in Drive.
 */

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
export const KOBO_FOLDER_NAME = "Rakuten Kobo"
export const SYNC_FOLDER_NAME = "Storyteller"

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const API_URL = "https://www.googleapis.com/drive/v3"
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3"
const FOLDER_MIME = "application/vnd.google-apps.folder"
const EPUB_MIME = "application/epub+zip"

export type FetchFn = typeof fetch

export type DriveErrorCode =
  | "reauth-needed"
  | "kobo-folder-missing"
  | "kobo-folder-ambiguous"
  | "google-error"

export class DriveError extends Error {
  constructor(
    readonly code: DriveErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "DriveError"
  }
}

export type OAuthClient = { clientId: string; clientSecret: string }

export function buildAuthUrl(
  { clientId }: Pick<OAuthClient, "clientId">,
  redirectUri: string,
  state: string,
) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPE,
    access_type: "offline",
    // Without this Google only returns a refresh token the first time.
    prompt: "consent",
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: string | { message?: string }
      error_description?: string
    }
    if (typeof body.error === "object") return body.error.message ?? ""
    return body.error_description ?? body.error ?? ""
  } catch {
    return ""
  }
}

async function tokenRequest(
  params: Record<string, string>,
  fetchFn: FetchFn,
): Promise<{ access_token: string; refresh_token?: string }> {
  const response = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  })
  if (!response.ok) {
    const detail = await readError(response)
    if (
      params["grant_type"] === "refresh_token" &&
      /invalid_grant/i.test(detail)
    ) {
      throw new DriveError(
        "reauth-needed",
        "Google no longer accepts the saved sign-in. Connect Google Drive again.",
      )
    }
    throw new DriveError(
      "google-error",
      `Google refused the sign-in${detail ? `: ${detail}` : ""}`,
    )
  }
  return (await response.json()) as {
    access_token: string
    refresh_token?: string
  }
}

export async function exchangeCode(
  client: OAuthClient,
  code: string,
  redirectUri: string,
  fetchFn: FetchFn = fetch,
) {
  return await tokenRequest(
    {
      grant_type: "authorization_code",
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: redirectUri,
    },
    fetchFn,
  )
}

export async function refreshAccessToken(
  client: OAuthClient,
  refreshToken: string,
  fetchFn: FetchFn = fetch,
) {
  const { access_token } = await tokenRequest(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    },
    fetchFn,
  )
  return access_token
}

async function driveJson<T>(
  url: string,
  accessToken: string,
  fetchFn: FetchFn,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetchFn(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  if (!response.ok) {
    const detail = await readError(response)
    throw new DriveError(
      "google-error",
      `Google Drive said ${response.status}${detail ? `: ${detail}` : ""}`,
    )
  }
  return (await response.json()) as T
}

export async function getAccountEmail(
  accessToken: string,
  fetchFn: FetchFn = fetch,
) {
  const about = await driveJson<{ user?: { emailAddress?: string } }>(
    `${API_URL}/about?fields=user(emailAddress)`,
    accessToken,
    fetchFn,
  )
  return about.user?.emailAddress ?? null
}

function quote(value: string) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`
}

type DriveFile = { id: string; name: string }

async function listFiles(
  query: string,
  accessToken: string,
  fetchFn: FetchFn,
): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name)",
    pageSize: "10",
    spaces: "drive",
  })
  const { files } = await driveJson<{ files: DriveFile[] }>(
    `${API_URL}/files?${params.toString()}`,
    accessToken,
    fetchFn,
  )
  return files
}

/**
 * Finds "Rakuten Kobo" (made by Kobo, never created here) and returns the
 * "Storyteller" folder inside it, creating that one if it is missing.
 */
export async function ensureSyncFolder(
  accessToken: string,
  fetchFn: FetchFn = fetch,
) {
  const koboFolders = await listFiles(
    `name = ${quote(KOBO_FOLDER_NAME)} and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`,
    accessToken,
    fetchFn,
  )
  if (koboFolders.length === 0) {
    throw new DriveError(
      "kobo-folder-missing",
      `There is no "${KOBO_FOLDER_NAME}" folder in this Google Drive. Link Google Drive on the Kobo first, so Kobo creates it.`,
    )
  }
  const [kobo] = koboFolders
  if (koboFolders.length > 1 || !kobo) {
    throw new DriveError(
      "kobo-folder-ambiguous",
      `There is more than one "${KOBO_FOLDER_NAME}" folder in this Google Drive. Remove or rename the extra ones.`,
    )
  }

  const [existing] = await listFiles(
    `name = ${quote(SYNC_FOLDER_NAME)} and mimeType = '${FOLDER_MIME}' and ${quote(kobo.id)} in parents and trashed = false`,
    accessToken,
    fetchFn,
  )
  if (existing) return existing.id

  const created = await driveJson<{ id: string }>(
    `${API_URL}/files?fields=id`,
    accessToken,
    fetchFn,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: SYNC_FOLDER_NAME,
        mimeType: FOLDER_MIME,
        parents: [kobo.id],
      }),
    },
  )
  return created.id
}

/** Whether a folder id still exists and is not in the bin. */
async function folderUsable(
  folderId: string,
  accessToken: string,
  fetchFn: FetchFn,
) {
  const response = await fetchFn(
    `${API_URL}/files/${encodeURIComponent(folderId)}?fields=id,trashed,mimeType`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!response.ok) return false
  const file = (await response.json()) as {
    trashed?: boolean
    mimeType?: string
  }
  return !file.trashed && file.mimeType === FOLDER_MIME
}

export async function resolveSyncFolder(
  savedFolderId: string | null,
  accessToken: string,
  fetchFn: FetchFn = fetch,
) {
  if (
    savedFolderId &&
    (await folderUsable(savedFolderId, accessToken, fetchFn))
  ) {
    return savedFolderId
  }
  return await ensureSyncFolder(accessToken, fetchFn)
}

export async function findFileInFolder(
  folderId: string,
  name: string,
  accessToken: string,
  fetchFn: FetchFn = fetch,
) {
  const [file] = await listFiles(
    `name = ${quote(name)} and ${quote(folderId)} in parents and trashed = false`,
    accessToken,
    fetchFn,
  )
  return file ?? null
}

async function uploadBytes(
  initUrl: string,
  method: "POST" | "PATCH",
  metadata: Record<string, unknown>,
  bytes: Buffer,
  accessToken: string,
  fetchFn: FetchFn,
) {
  const init = await fetchFn(initUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": EPUB_MIME,
      "X-Upload-Content-Length": String(bytes.length),
    },
    body: JSON.stringify(metadata),
  })
  const location = init.headers.get("location")
  if (!init.ok || !location) {
    const detail = await readError(init)
    throw new DriveError(
      "google-error",
      `Google Drive would not start the upload${detail ? `: ${detail}` : ""}`,
    )
  }

  const put = await fetchFn(location, {
    method: "PUT",
    headers: { "Content-Type": EPUB_MIME },
    body: new Uint8Array(bytes),
  })
  if (!put.ok) {
    const detail = await readError(put)
    throw new DriveError(
      "google-error",
      `Google Drive rejected the file${detail ? `: ${detail}` : ""}`,
    )
  }
  return (await put.json()) as { id: string }
}

export async function createEpub(
  folderId: string,
  name: string,
  bytes: Buffer,
  accessToken: string,
  fetchFn: FetchFn = fetch,
) {
  return await uploadBytes(
    `${UPLOAD_URL}/files?uploadType=resumable&fields=id`,
    "POST",
    { name, parents: [folderId], mimeType: EPUB_MIME },
    bytes,
    accessToken,
    fetchFn,
  )
}

export async function replaceEpub(
  fileId: string,
  name: string,
  bytes: Buffer,
  accessToken: string,
  fetchFn: FetchFn = fetch,
) {
  return await uploadBytes(
    `${UPLOAD_URL}/files/${encodeURIComponent(fileId)}?uploadType=resumable&fields=id`,
    "PATCH",
    { name },
    bytes,
    accessToken,
    fetchFn,
  )
}

export type SyncableBook = {
  uuid: UUID
  title: string
  authors?: { name: string }[]
  ebook?: { filepath?: string | null; missing?: boolean | null } | null
}

export type BookSyncStatus = "sent" | "replaced" | "skipped" | "failed"

export type BookSyncResult = {
  uuid: UUID
  title: string
  status: BookSyncStatus
  message?: string
  driveFileId?: string
  fileName?: string
}

/** "Title - Author.epub", so two books with the same title do not collide. */
export function driveFileName(
  book: Pick<SyncableBook, "title" | "authors" | "uuid">,
) {
  const title = safeFilename(book.title) || book.uuid
  const author = safeFilename(book.authors?.[0]?.name ?? "")
  const base = author ? `${title} - ${author}` : title
  return `${base.slice(0, 180).trim()}.epub`
}

export type SyncDeps = {
  fetchFn?: FetchFn
  readEpub?: (filepath: string) => Promise<Buffer>
  record?: (
    bookUuid: UUID,
    driveFileId: string,
    fileName: string,
  ) => Promise<void>
}

/**
 * Copies the plain ebook of each book into the Drive folder. Only the ebook
 * is sent: never an audiobook and never a read-aloud version. A file that is
 * already in the folder is left alone unless `overwrite` is set. One book
 * failing does not stop the others.
 */
export async function syncBooksToDrive(
  books: SyncableBook[],
  options: { accessToken: string; folderId: string; overwrite: boolean },
  deps: SyncDeps = {},
): Promise<BookSyncResult[]> {
  const fetchFn = deps.fetchFn ?? fetch
  const readEpub = deps.readEpub ?? ((filepath: string) => readFile(filepath))
  const results: BookSyncResult[] = []

  for (const book of books) {
    const base = { uuid: book.uuid, title: book.title }
    const filepath = book.ebook?.filepath
    if (!filepath || book.ebook?.missing) {
      results.push({
        ...base,
        status: "failed",
        message: "This book has no ebook file",
      })
      continue
    }
    if (/_epub2\.epub$/i.test(filepath)) {
      results.push({
        ...base,
        status: "failed",
        message: "The ebook on file is an _epub2 copy, so it was not sent",
      })
      continue
    }

    const fileName = driveFileName(book)
    try {
      const existing = await findFileInFolder(
        options.folderId,
        fileName,
        options.accessToken,
        fetchFn,
      )

      if (existing && !options.overwrite) {
        await deps.record?.(book.uuid, existing.id, fileName)
        results.push({
          ...base,
          status: "skipped",
          message: "Already in the Drive folder",
          driveFileId: existing.id,
          fileName,
        })
        continue
      }

      const bytes = await readEpub(filepath)
      const uploaded = existing
        ? await replaceEpub(
            existing.id,
            fileName,
            bytes,
            options.accessToken,
            fetchFn,
          )
        : await createEpub(
            options.folderId,
            fileName,
            bytes,
            options.accessToken,
            fetchFn,
          )

      await deps.record?.(book.uuid, uploaded.id, fileName)
      results.push({
        ...base,
        status: existing ? "replaced" : "sent",
        driveFileId: uploaded.id,
        fileName,
      })
    } catch (error) {
      if (error instanceof DriveError && error.code === "reauth-needed")
        throw error
      results.push({
        ...base,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return results
}
