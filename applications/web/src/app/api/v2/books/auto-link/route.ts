import { withHasPermission } from "@/auth/auth"
import { runBookLinker } from "@/bookLinker"

/**
 * Shows what the ebook/audiobook linker would merge, and changes nothing. Safe
 * to open in a browser while logged in.
 */
export const GET = withHasPermission("bookCreate")(async (request) => {
  // ?level=probable shows what a run would do if probable matches were allowed.
  const level =
    new URL(request.url).searchParams.get("level") === "probable"
      ? "probable"
      : undefined
  const result = await runBookLinker({
    dryRun: true,
    ...(level ? { level } : {}),
  })
  return Response.json(result)
})

/**
 * Runs the ebook/audiobook linker now instead of waiting for the nightly run.
 * Add ?dryRun=true to see what it would link without changing anything.
 */
export const POST = withHasPermission("bookCreate")(async (request) => {
  const params = new URL(request.url).searchParams
  const dryRun = params.get("dryRun") === "true"
  // ?level=probable also joins same-title matches without a matching author,
  // as the preview in Settings shows.
  const level = params.get("level") === "probable" ? "probable" : undefined
  const result = await runBookLinker({ dryRun, ...(level ? { level } : {}) })
  return Response.json(result)
})
