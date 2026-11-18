import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getBooks } from "@/database/books"
import { getKindleSends } from "@/database/kindleSends"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

/**
 * @summary Which of the given books this user already sent to a Kindle
 *
 * Returns a map from book id to when it was last sent and to which address.
 * Books that were never sent are left out. Only books this user can see are
 * looked up, at most 500.
 */
export const POST = withHasPermission("bookDownload")(async (request) => {
  const { books: uuids } = (await request.json()) as { books?: UUID[] }
  if (!Array.isArray(uuids) || uuids.length === 0) {
    return NextResponse.json({})
  }

  const visible = await getBooks(uuids.slice(0, 500), request.auth.user.id)
  const sends = await getKindleSends(
    request.auth.user.id,
    visible.map((book) => book.uuid),
  )

  return NextResponse.json(
    Object.fromEntries(
      [...sends].map(([uuid, send]) => [
        uuid,
        { sentAt: send.sentAt, address: send.address },
      ]),
    ),
  )
})
