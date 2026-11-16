import { withHasPermission } from "@/auth/auth"
import { planTidy, runTidy } from "@/libraryTidy"

/** Shows what the tidy run would merge, and changes nothing. */
export const GET = withHasPermission("bookCreate")(async () => {
  return Response.json(await planTidy())
})

/**
 * Runs the tidy now instead of waiting for the nightly run. Add ?dryRun=true
 * to see what it would merge without changing anything.
 */
export const POST = withHasPermission("bookCreate")(async (request) => {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true"
  return Response.json(await runTidy({ dryRun }))
})
