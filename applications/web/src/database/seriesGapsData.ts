import { type GapSeriesInput } from "@/seriesGaps"
import { type UUID } from "@/uuid"

import { db } from "./connection"
import { bookVisibleTo } from "./shelfFilter"

/**
 * Loads series with their book positions and authors, counting only books the
 * given user can see.
 */
export async function getSeriesForGaps(
  userId: UUID,
): Promise<GapSeriesInput[]> {
  const rows = await db
    .selectFrom("bookToSeries")
    .innerJoin("series", "series.uuid", "bookToSeries.seriesUuid")
    .where((eb) => bookVisibleTo(eb, "bookToSeries.bookUuid", userId))
    .select([
      "series.uuid as seriesUuid",
      "series.name as seriesName",
      "bookToSeries.bookUuid as bookUuid",
      "bookToSeries.position as position",
    ])
    .execute()

  const authorRows = await db
    .selectFrom("bookToSeries")
    .innerJoin(
      "bookToCreator",
      "bookToCreator.bookUuid",
      "bookToSeries.bookUuid",
    )
    .innerJoin("creator", "creator.uuid", "bookToCreator.creatorUuid")
    .where("bookToCreator.role", "=", "aut")
    .where((eb) => bookVisibleTo(eb, "bookToSeries.bookUuid", userId))
    .select(["bookToSeries.seriesUuid as seriesUuid", "creator.name as name"])
    .distinct()
    .execute()

  const authorsBySeries = new Map<string, string[]>()
  for (const row of authorRows) {
    const list = authorsBySeries.get(row.seriesUuid) ?? []
    list.push(row.name)
    authorsBySeries.set(row.seriesUuid, list)
  }

  const bySeries = new Map<string, GapSeriesInput>()
  for (const row of rows) {
    let entry = bySeries.get(row.seriesUuid)
    if (!entry) {
      entry = {
        uuid: row.seriesUuid,
        name: row.seriesName,
        authors: (authorsBySeries.get(row.seriesUuid) ?? []).sort((a, b) =>
          a.localeCompare(b),
        ),
        books: [],
      }
      bySeries.set(row.seriesUuid, entry)
    }
    entry.books.push({ bookUuid: row.bookUuid, position: row.position })
  }
  return [...bySeries.values()]
}
