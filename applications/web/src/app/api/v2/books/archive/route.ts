import { withHasPermission } from "@/auth/auth"
import { setBooksArchived } from "@/database/books"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

/**
 * @summary Move books to the Archive or back to the library
 * @desc Archiving is shared by everyone. An archived book keeps all its files
 *       and data but is hidden from every listing except `archived=only`.
 *       The book's `updated_at` is bumped, so clients that sync incrementally
 *       notice the change. Books that already are in the requested state are
 *       left alone.
 */
export const POST = withHasPermission("bookUpdate")(async (request) => {
  const body = (await request.json().catch(() => null)) as {
    books?: unknown
    archived?: unknown
  } | null

  if (
    !body ||
    !Array.isArray(body.books) ||
    !body.books.every((uuid) => typeof uuid === "string") ||
    typeof body.archived !== "boolean"
  ) {
    return Response.json(
      { message: "Expected { books: string[], archived: boolean }" },
      { status: 400 },
    )
  }

  await setBooksArchived(body.books as UUID[], body.archived)

  return new Response(null, { status: 204 })
})
