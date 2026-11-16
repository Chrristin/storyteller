import { db } from "@/database/connection"
import { mergeCreators } from "@/database/creators"
import { mergeSeries } from "@/database/series"
import { logger } from "@/logging"
import {
  chooseCanonical,
  normaliseAuthorName,
  normaliseSeriesName,
} from "@/nameKey"
import { type UUID } from "@/uuid"

/**
 * Conservative clean-up of duplicate authors and series. Two names are only
 * treated as the same when they are identical after normalising case,
 * diacritics, punctuation and spacing (plus initials for authors, and
 * "The ..." / "... Series" for series). There is no fuzzy matching.
 */

export type TidyKind = "author" | "series"

export type TidyEntity = { uuid: UUID; name: string; books: number }

export type TidyMerge = {
  kind: TidyKind
  key: string
  target: TidyEntity
  sources: TidyEntity[]
}

export type TidyPlan = { merges: TidyMerge[] }

export type TidyRunResult = {
  dryRun: boolean
  merges: (TidyMerge & { merged: boolean; error?: string })[]
}

export { chooseCanonical, normaliseAuthorName, normaliseSeriesName }

export function groupDuplicates(
  kind: TidyKind,
  entities: TidyEntity[],
): TidyMerge[] {
  const normalise =
    kind === "author" ? normaliseAuthorName : normaliseSeriesName
  const groups = new Map<string, TidyEntity[]>()
  for (const entity of entities) {
    const key = normalise(entity.name)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(entity)
    groups.set(key, list)
  }

  const merges: TidyMerge[] = []
  for (const [key, group] of groups) {
    if (group.length < 2) continue
    const target = chooseCanonical(group)
    const sources = group
      .filter((e) => e.uuid !== target.uuid)
      .sort((a, b) => a.name.localeCompare(b.name))
    merges.push({ kind, key, target, sources })
  }
  return merges.sort((a, b) => a.key.localeCompare(b.key))
}

async function loadAuthors(): Promise<TidyEntity[]> {
  const rows = await db
    .selectFrom("creator")
    .innerJoin("bookToCreator", "bookToCreator.creatorUuid", "creator.uuid")
    .where("bookToCreator.role", "=", "aut")
    .groupBy("creator.uuid")
    .select((eb) => [
      "creator.uuid as uuid",
      "creator.name as name",
      eb.fn.count<number>("bookToCreator.bookUuid").distinct().as("books"),
    ])
    .execute()
  return rows.map((r) => ({
    uuid: r.uuid,
    name: r.name,
    books: Number(r.books),
  }))
}

async function loadSeries(): Promise<TidyEntity[]> {
  const rows = await db
    .selectFrom("series")
    .leftJoin("bookToSeries", "bookToSeries.seriesUuid", "series.uuid")
    .groupBy("series.uuid")
    .select((eb) => [
      "series.uuid as uuid",
      "series.name as name",
      eb.fn.count<number>("bookToSeries.bookUuid").as("books"),
    ])
    .execute()
  return rows.map((r) => ({
    uuid: r.uuid,
    name: r.name,
    books: Number(r.books),
  }))
}

/** Read only: what a run would merge. */
export async function planTidy(): Promise<TidyPlan> {
  const [authors, series] = await Promise.all([loadAuthors(), loadSeries()])
  return {
    merges: [
      ...groupDuplicates("author", authors),
      ...groupDuplicates("series", series),
    ],
  }
}

/**
 * When a book sits in several of the series being merged, give every link the
 * lowest position so the merge keeps that one whichever link it copies.
 */
async function alignSeriesPositions(uuids: UUID[]) {
  const links = await db
    .selectFrom("bookToSeries")
    .select(["uuid", "bookUuid", "position"])
    .where("seriesUuid", "in", uuids)
    .execute()

  const lowest = new Map<string, number>()
  for (const link of links) {
    if (link.position === null) continue
    const current = lowest.get(link.bookUuid)
    if (current === undefined || link.position < current) {
      lowest.set(link.bookUuid, link.position)
    }
  }

  for (const link of links) {
    const best = lowest.get(link.bookUuid)
    if (best !== undefined && link.position !== best) {
      await db
        .updateTable("bookToSeries")
        .set({ position: best })
        .where("uuid", "=", link.uuid)
        .execute()
    }
  }
}

export async function runTidy(
  options: { dryRun?: boolean } = {},
): Promise<TidyRunResult> {
  const dryRun = options.dryRun ?? false
  const { merges } = await planTidy()
  const result: TidyRunResult = { dryRun, merges: [] }

  for (const merge of merges) {
    const entry: TidyRunResult["merges"][number] = { ...merge, merged: false }
    if (!dryRun) {
      const sourceUuids = merge.sources.map((s) => s.uuid)
      try {
        if (merge.kind === "author") {
          await mergeCreators(merge.target.uuid, sourceUuids)
        } else {
          await alignSeriesPositions([merge.target.uuid, ...sourceUuids])
          await mergeSeries(merge.target.uuid, sourceUuids)
        }
        entry.merged = true
        logger.info(
          `Tidy merged ${merge.kind} ${merge.sources.map((s) => `"${s.name}"`).join(", ")} into "${merge.target.name}"`,
        )
      } catch (error) {
        entry.error = error instanceof Error ? error.message : String(error)
        logger.error({
          msg: `Tidy failed to merge ${merge.kind} into "${merge.target.name}"`,
          err: error,
        })
      }
    }
    result.merges.push(entry)
  }

  logger.info(
    `Library tidy ${dryRun ? "(dry run) " : ""}found ${merges.length} groups to merge`,
  )
  return result
}
