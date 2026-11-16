import { withHasPermission } from "@/auth/auth"
import { getSeriesForGaps } from "@/database/seriesGapsData"
import { findSeriesGaps } from "@/seriesGaps"

/**
 * Series with missing books, counting only books the signed-in user can see.
 */
export const GET = withHasPermission("bookRead")(async (request) => {
  const series = await getSeriesForGaps(request.auth.user.id)
  return Response.json(findSeriesGaps(series))
})
