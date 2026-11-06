import { withHasPermission } from "@/auth/auth"
import { runBookLinker } from "@/bookLinker"

/**
 * Shows what the ebook/audiobook linker would merge, and changes nothing. Safe
 * to open in a browser while logged in.
 */
export const GET = withHasPermission("bookCreate")(async () => {
  const result = await runBookLinker({ dryRun: true })
  return Response.json(result)
})

/**
 * Runs the ebook/audiobook linker now instead of waiting for the nightly run.
 * Add ?dryRun=true to see what it would link without changing anything.
 */
export const POST = withHasPermission("bookCreate")(async (request) => {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true"
  const result = await runBookLinker({ dryRun })
  return Response.json(result)
})
