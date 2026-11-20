import { withHasPermission } from "@/auth/auth"
import { generateMissingCovers } from "@/images/generatedCovers"

/**
 * Draws a cover from the title for every ebook and read-aloud that has no
 * cover. Audiobooks, covers the user removed, and books that already have a
 * cover are left alone. Manual only: nothing runs this on a schedule.
 */
export const POST = withHasPermission("bookUpdate")(async () => {
  const result = await generateMissingCovers()
  return Response.json(result)
})
