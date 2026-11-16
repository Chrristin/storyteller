import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getBooks } from "@/database/books"
import { getBookDriveFiles } from "@/database/googleDrive"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

/**
 * @summary Which of the given books have already been copied to Google Drive
 *
 * Returns a map from book id to when it was last copied. Books that were never
 * copied are left out. Only books this user can see are looked up.
 */
export const POST = withHasPermission("bookDownload")(async (request) => {
  const { books: uuids } = (await request.json()) as { books?: UUID[] }
  if (!Array.isArray(uuids) || uuids.length === 0) {
    return NextResponse.json({})
  }

  const visible = await getBooks(uuids.slice(0, 500), request.auth.user.id)
  const files = await getBookDriveFiles(visible.map((book) => book.uuid))

  return NextResponse.json(
    Object.fromEntries(
      [...files].map(([uuid, file]) => [
        uuid,
        { syncedAt: file.syncedAt, fileName: file.fileName },
      ]),
    ),
  )
})
