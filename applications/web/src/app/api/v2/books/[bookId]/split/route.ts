import { withHasPermission } from "@/auth/auth"
import { BookSplitError, splitAudiobookFromBook } from "@/database/bookSplit"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type Params = Promise<{ bookId: UUID }>

/**
 * @summary Split the audiobook of a book onto a book of its own
 * @desc The reverse of a merge, for a book that has both an ebook and an
 *       audiobook (not a read-aloud). The ebook stays on this book with the
 *       reading status, rating and progress. The new book gets the same
 *       title, authors, narrators, series, tags and collections, a copy of
 *       each user's status and rating, and the audiobook with its progress.
 *       No media file is moved or deleted. The two books are remembered so
 *       the automatic linker never joins them again; a manual merge still
 *       works. Refused with 409 when the audiobook files live inside
 *       Storyteller's own asset folder.
 * @body { keep: "ebook" }
 */
export const POST = withHasPermission<Params>("bookCreate")(async (
  request,
  context,
) => {
  const { bookId } = await context.params
  const body = (await request.json().catch(() => null)) as {
    keep?: unknown
  } | null

  if (body?.keep !== "ebook") {
    return Response.json(
      { message: 'Expected { keep: "ebook" }' },
      { status: 400 },
    )
  }

  try {
    const created = await splitAudiobookFromBook(bookId, request.auth.user.id)
    return Response.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof BookSplitError) {
      return Response.json({ message: error.message }, { status: error.status })
    }
    throw error
  }
})
