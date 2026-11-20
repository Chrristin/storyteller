import { db } from "@/database/connection"
import {
  type ReviewItem,
  listItemsForBooks,
  listSureItems,
  markAccepted,
} from "@/database/hardcoverIdentity"
import { addBooksToSeries } from "@/database/series"
import { addTagsToBooks } from "@/database/tags"
import { logger } from "@/logging"
import { normaliseSeriesName } from "@/nameKey"
import { type UUID } from "@/uuid"

import { isWholePosition } from "./series"

/**
 * Applies the 'sure' suggestions ("Accept all"). It only ever adds: a book is
 * added to a series, genres are added as tags. Nothing is removed and authors
 * are never touched. Moods are not applied.
 */

export type ApplyResult = {
  /** Books added to a series. */
  seriesAdded: number
  /** Book and tag pairs that did not exist before. */
  tagsAdded: number
  /** Books that were already in the suggested series. */
  skipped: number
  /** Books marked accepted. */
  accepted: number
}

const BATCH_SIZE = 25

type ExistingSeries = { uuid: UUID; name: string; books: number }

async function loadSeriesByKey(): Promise<Map<string, ExistingSeries>> {
  const rows = await db
    .selectFrom("series")
    .leftJoin("bookToSeries", "bookToSeries.seriesUuid", "series.uuid")
    .select([
      "series.uuid",
      "series.name",
      (eb) => eb.fn.count<number>("bookToSeries.uuid").as("books"),
    ])
    .groupBy("series.uuid")
    .execute()

  const byKey = new Map<string, ExistingSeries>()
  for (const row of rows) {
    const candidate = {
      uuid: row.uuid,
      name: row.name,
      books: Number(row.books),
    }
    const key = normaliseSeriesName(row.name)
    const current = byKey.get(key)
    // The series with the most books wins, then the name that sorts first, so
    // the choice is stable.
    if (
      !current ||
      candidate.books > current.books ||
      (candidate.books === current.books &&
        candidate.name.localeCompare(current.name) < 0)
    ) {
      byKey.set(key, candidate)
    }
  }
  return byKey
}

async function loadTagsByName(): Promise<Map<string, UUID>> {
  const rows = await db.selectFrom("tag").select(["uuid", "name"]).execute()
  const map = new Map<string, UUID>()
  for (const row of rows) map.set(row.name.trim().toLowerCase(), row.uuid)
  return map
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}

async function existingTagPairs(bookUuids: UUID[], tagUuids: UUID[]) {
  if (bookUuids.length === 0 || tagUuids.length === 0) return new Set<string>()
  const rows = await db
    .selectFrom("bookToTag")
    .select(["bookUuid", "tagUuid"])
    .where("bookUuid", "in", bookUuids)
    .where("tagUuid", "in", tagUuids)
    .execute()
  return new Set(rows.map((row) => `${row.bookUuid}:${row.tagUuid}`))
}

async function applyGenres(items: ReviewItem[]): Promise<number> {
  const byGenre = new Map<string, UUID[]>()
  for (const item of items) {
    for (const genre of item.genres) {
      byGenre.set(genre, [...(byGenre.get(genre) ?? []), item.bookUuid])
    }
  }
  if (byGenre.size === 0) return 0

  let added = 0
  for (const [genre, bookUuids] of byGenre) {
    // Use an existing tag whatever its capitalisation, so "science fiction"
    // and "Science Fiction" do not become two tags.
    const tagsByName = await loadTagsByName()
    const existing = tagsByName.get(genre.toLowerCase())
    const before = existing
      ? await existingTagPairs(bookUuids, [existing])
      : new Set<string>()
    await addTagsToBooks(bookUuids, [
      existing ? { uuid: existing } : { name: genre },
    ])
    added += bookUuids.filter(
      (uuid) => !before.has(`${uuid}:${existing ?? ""}`),
    ).length
  }
  return added
}

export async function acceptAllSure(userId?: UUID): Promise<ApplyResult> {
  return await applyItems(await listSureItems(userId))
}

/**
 * "Accept N selected": applies the chosen books exactly like Accept all does,
 * for books whose suggestion is 'check' or 'sure' right now. A book in any
 * other state (none, accepted, pending, error, not visible) is ignored.
 */
export async function acceptSelected(
  bookUuids: UUID[],
  userId?: UUID,
): Promise<ApplyResult> {
  return await applyItems(await listItemsForBooks(bookUuids, userId))
}

async function applyItems(items: ReviewItem[]): Promise<ApplyResult> {
  const result: ApplyResult = {
    seriesAdded: 0,
    tagsAdded: 0,
    skipped: 0,
    accepted: 0,
  }
  if (items.length === 0) return result

  const seriesByKey = await loadSeriesByKey()

  // Group the books by the series they should join.
  const groups = new Map<string, { name: string; items: ReviewItem[] }>()
  for (const item of items) {
    if (!item.suggestedSeries) continue
    const key = normaliseSeriesName(item.suggestedSeries)
    const alreadyIn = item.currentSeries.some(
      (name) => normaliseSeriesName(name) === key,
    )
    if (alreadyIn) {
      result.skipped += 1
      continue
    }
    const group = groups.get(key) ?? {
      // Attach to the library's own series when there is one with the same
      // normalised name, so no duplicate series is created.
      name: seriesByKey.get(key)?.name ?? item.suggestedSeries,
      items: [],
    }
    group.items.push(item)
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    for (const batch of chunk(group.items, BATCH_SIZE)) {
      const existing = seriesByKey.get(normaliseSeriesName(group.name))
      await addBooksToSeries(
        { name: group.name, ...(existing ? { uuid: existing.uuid } : {}) },
        batch.map((item) => ({
          bookUuid: item.bookUuid,
          position: isWholePosition(item.suggestedPosition)
            ? item.suggestedPosition
            : null,
          // The first series a book gets is the one shown on its card.
          ...(item.currentSeries.length === 0 ? { featured: true } : {}),
        })),
      )
      result.seriesAdded += batch.length
      if (!existing) {
        // The series now exists. Later batches and groups reuse it.
        const created = await loadSeriesByKey()
        const found = created.get(normaliseSeriesName(group.name))
        if (found) seriesByKey.set(normaliseSeriesName(group.name), found)
      }
    }
  }

  for (const batch of chunk(items, BATCH_SIZE)) {
    result.tagsAdded += await applyGenres(batch)
    await markAccepted(
      batch.map((item) => item.bookUuid),
      ["sure", "check"],
    )
    result.accepted += batch.length
  }

  logger.info({ msg: "Hardcover suggestions accepted", ...result })
  return result
}
