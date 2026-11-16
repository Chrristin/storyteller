import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getBooks } from "@/database/books"
import { recordBookDriveFile } from "@/database/googleDrive"
import { DriveError, syncBooksToDrive } from "@/googleDrive"
import { openDriveSession } from "@/googleDriveSession"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

/** Kept small so one request finishes well inside a reverse proxy's time limit. */
export const DRIVE_MAX_BOOKS_PER_REQUEST = 25

/**
 * @summary Copy the ebooks of the selected books to the Google Drive folder
 *
 * Sends only the plain ebook of each book, never audiobooks or read-aloud
 * versions. A book already in the folder is skipped unless `overwrite` is true.
 * Send at most 25 books per request; split larger selections into batches.
 * Each user copies to their own Google Drive, once they have connected it.
 */
export const POST = withHasPermission("bookDownload")(async (request) => {
  const { books: uuids, overwrite } = (await request.json()) as {
    books?: UUID[]
    overwrite?: boolean
  }

  if (!Array.isArray(uuids) || uuids.length === 0) {
    return NextResponse.json({ message: "No books selected" }, { status: 400 })
  }
  if (uuids.length > DRIVE_MAX_BOOKS_PER_REQUEST) {
    return NextResponse.json(
      {
        code: "too-many",
        message: `Send at most ${DRIVE_MAX_BOOKS_PER_REQUEST} books at a time`,
      },
      { status: 422 },
    )
  }

  // Only books this user can see, like every other book route.
  const books = await getBooks(uuids, request.auth.user.id)

  try {
    const userId = request.auth.user.id
    const { accessToken, folderId } = await openDriveSession(userId)
    const results = await syncBooksToDrive(
      books,
      { accessToken, folderId, overwrite: overwrite === true },
      {
        record: (bookUuid, driveFileId, fileName) =>
          recordBookDriveFile(userId, bookUuid, driveFileId, fileName),
      },
    )
    const count = (status: string) =>
      results.filter((result) => result.status === status).length
    return NextResponse.json({
      sent: count("sent"),
      replaced: count("replaced"),
      skipped: count("skipped"),
      failed: count("failed"),
      results,
    })
  } catch (error) {
    if (error instanceof DriveError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.code === "google-error" ? 502 : 409 },
      )
    }
    logger.error({ msg: "Google Drive sync failed", err: error })
    return NextResponse.json(
      {
        code: "sync-failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
})
