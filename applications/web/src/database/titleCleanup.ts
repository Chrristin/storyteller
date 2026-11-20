import { randomUUID } from "node:crypto"

import { logger } from "@/logging"
import { normaliseAuthorName } from "@/nameKey"
import { type CleanTitleContext, cleanTitle, titleKey } from "@/titleCleanup"
import { type UUID } from "@/uuid"

import { getBook, updateBook } from "./books"
import { db } from "./connection"

/**
 * Title clean-up for the whole library: a preview, an apply that keeps the old
 * titles (table title_cleanup_log, migration 136) and an undo. Nothing here
 * runs on its own. The rules live in the pure src/titleCleanup.ts.
 *
 * A title is changed with updateBook, exactly like the book edit form does, and
 * the same follow-up is queued: queueWritesToFiles, which writes the new title
 * into the book's epub and audio files. See applyTitleCleanup.
 */

export type TitleCleanupItem = {
  bookUuid: UUID
  oldTitle: string
  newTitle: string
  reason: string
}

export type TitleCleanupPage = {
  total: number
  items: TitleCleanupItem[]
}

export type TitleCleanupError = { bookUuid: UUID; message: string }

export type TitleCleanupApplyResult = {
  batchId: string | null
  applied: number
  /** Books whose title changed since the preview, or that no longer need a change. */
  skipped: number
  errors: TitleCleanupError[]
}

export type TitleCleanupUndoResult = {
  batchId: string | null
  restored: number
  /** Books whose title was edited since the clean-up; left alone. */
  skipped: number
  errors: TitleCleanupError[]
}

export type TitleCleanupBatch = {
  batchId: string
  appliedAt: string
  count: number
}

const BATCH_SIZE = 25

export type CleanupRow = {
  uuid: UUID
  title: string
  hasEbook: boolean
  hasAudio: boolean
  authorKeys: string[]
  positions: number[]
  known: string[]
}

async function loadRows(): Promise<CleanupRow[]> {
  const [books, creators, series, identities, ebooks, audiobooks, readalouds] =
    await Promise.all([
      db.selectFrom("book").select(["uuid", "title"]).execute(),
      db
        .selectFrom("bookToCreator")
        .innerJoin("creator", "creator.uuid", "bookToCreator.creatorUuid")
        .select(["bookToCreator.bookUuid", "creator.name"])
        .where("bookToCreator.role", "=", "aut")
        .execute(),
      db
        .selectFrom("bookToSeries")
        .select(["bookUuid", "position"])
        .where("position", "is not", null)
        .execute(),
      db
        .selectFrom("hardcoverIdentity")
        .select(["bookUuid", "matchedTitle"])
        .where("status", "in", ["sure", "accepted"])
        .where("matchedTitle", "is not", null)
        .execute(),
      db.selectFrom("ebook").select("bookUuid").execute(),
      db.selectFrom("audiobook").select("bookUuid").execute(),
      db.selectFrom("readaloud").select("bookUuid").execute(),
    ])

  const group = <T extends { bookUuid: UUID }, V>(
    list: T[],
    pick: (item: T) => V | null,
  ) => {
    const map = new Map<UUID, V[]>()
    for (const item of list) {
      const value = pick(item)
      if (value === null) continue
      const bucket = map.get(item.bookUuid) ?? []
      bucket.push(value)
      map.set(item.bookUuid, bucket)
    }
    return map
  }
  const authorsByBook = group(
    creators,
    (c) => normaliseAuthorName(c.name) || null,
  )
  const positionsByBook = group(series, (s) => s.position)
  const knownByBook = group(identities, (i) => i.matchedTitle)
  const ebookSet = new Set(ebooks.map((e) => e.bookUuid))
  const audioSet = new Set(audiobooks.map((e) => e.bookUuid))
  const readaloudSet = new Set(readalouds.map((e) => e.bookUuid))

  return books.map((book) => ({
    uuid: book.uuid,
    title: book.title,
    hasEbook: ebookSet.has(book.uuid) || readaloudSet.has(book.uuid),
    hasAudio: audioSet.has(book.uuid),
    authorKeys: authorsByBook.get(book.uuid) ?? [],
    positions: positionsByBook.get(book.uuid) ?? [],
    known: knownByBook.get(book.uuid) ?? [],
  }))
}

/**
 * Every book whose title would change. Pure over the rows, exported for tests.
 * For a book of one format, the same book in the other format (same author and
 * same title once the noise is gone) offers its own title as a known title.
 */
export function planFromRows(rows: CleanupRow[]): TitleCleanupItem[] {
  const stage = (row: CleanupRow) =>
    cleanTitle(row.title, { seriesPositions: row.positions }).title

  const ebookOnly = new Map<string, CleanupRow[]>()
  const audioOnly = new Map<string, CleanupRow[]>()
  for (const row of rows) {
    if (row.hasEbook === row.hasAudio) continue
    const target = row.hasEbook ? ebookOnly : audioOnly
    for (const author of row.authorKeys) {
      const bucket = target.get(author) ?? []
      bucket.push(row)
      target.set(author, bucket)
    }
  }

  const items: TitleCleanupItem[] = []
  for (const row of rows) {
    const known = [...row.known]
    if (row.hasEbook !== row.hasAudio) {
      const key = titleKey(stage(row))
      const others = row.hasEbook ? audioOnly : ebookOnly
      for (const author of row.authorKeys) {
        for (const other of others.get(author) ?? []) {
          if (other.uuid !== row.uuid && titleKey(stage(other)) === key) {
            known.push(stage(other), other.title)
          }
        }
      }
    }
    const context: CleanTitleContext = {
      seriesPositions: row.positions,
      knownTitles: known,
    }
    const result = cleanTitle(row.title, context)
    if (result.title !== row.title) {
      items.push({
        bookUuid: row.uuid,
        oldTitle: row.title,
        newTitle: result.title,
        reason: result.changes.join("; "),
      })
    }
  }
  return items.sort(
    (a, b) =>
      a.oldTitle.localeCompare(b.oldTitle) ||
      a.bookUuid.localeCompare(b.bookUuid),
  )
}

/** Read only. All books whose title would change. */
export async function previewTitleCleanup(): Promise<TitleCleanupItem[]> {
  return planFromRows(await loadRows())
}

export async function previewTitleCleanupPage(
  offset = 0,
  limit = 50,
): Promise<TitleCleanupPage> {
  const all = await previewTitleCleanup()
  return { total: all.length, items: all.slice(offset, offset + limit) }
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}

/** The same follow-up the book edit form queues after a save. */
async function queueFileWrite(bookUuid: UUID) {
  try {
    const { queueWritesToFiles } =
      await import("@/writeToFiles/fileWriteDistributor")
    void queueWritesToFiles(bookUuid).catch((error: unknown) => {
      logger.error({
        msg: "Title clean-up: file write failed",
        bookUuid,
        err: error,
      })
    })
  } catch (error) {
    logger.error({
      msg: "Title clean-up: could not queue file write",
      bookUuid,
      err: error,
    })
  }
}

export type ApplyOptions = {
  /**
   * Queue the file write a normal title edit queues (default true). It
   * rewrites the title inside each book's epub and audio files.
   */
  writeToFiles?: boolean
}

/**
 * Applies the previewed titles (all of them, or only the given books). Old
 * titles are written to title_cleanup_log first, 25 books per transaction; then
 * each title is saved with updateBook. One failing book never stops the run:
 * its log row is removed again and the error is collected.
 */
export async function applyTitleCleanup(
  bookUuids?: UUID[],
  { writeToFiles = true }: ApplyOptions = {},
): Promise<TitleCleanupApplyResult> {
  const wanted = bookUuids ? new Set(bookUuids) : null
  const plan = (await previewTitleCleanup()).filter(
    (item) => !wanted || wanted.has(item.bookUuid),
  )
  const result: TitleCleanupApplyResult = {
    batchId: null,
    applied: 0,
    skipped: wanted ? Math.max(0, wanted.size - plan.length) : 0,
    errors: [],
  }
  if (plan.length === 0) return result

  const batchId = randomUUID()
  result.batchId = batchId

  for (let i = 0; i < plan.length; i += BATCH_SIZE) {
    const batch = plan.slice(i, i + BATCH_SIZE)

    const logged = await db.transaction().execute(async (tr) => {
      const ids = new Map<UUID, number>()
      for (const item of batch) {
        const current = await tr
          .selectFrom("book")
          .select("title")
          .where("uuid", "=", item.bookUuid)
          .executeTakeFirst()
        if (!current || current.title !== item.oldTitle) {
          result.skipped += 1
          continue
        }
        const row = await tr
          .insertInto("titleCleanupLog")
          .values({
            bookUuid: item.bookUuid,
            oldTitle: item.oldTitle,
            newTitle: item.newTitle,
            batchId,
          })
          .returning("id")
          .executeTakeFirstOrThrow()
        ids.set(item.bookUuid, row.id)
      }
      return ids
    })

    for (const item of batch) {
      const logId = logged.get(item.bookUuid)
      if (logId === undefined) continue
      try {
        await updateBook(item.bookUuid, { title: item.newTitle })
        result.applied += 1
        if (writeToFiles) await queueFileWrite(item.bookUuid)
      } catch (error) {
        // updateBook saves the title first and moves the asset folder after,
        // so it can fail with the title already changed. Keep the log row in
        // that case, so the title can still be undone.
        const now = await getBook(item.bookUuid).catch(() => null)
        if (now?.title === item.newTitle) {
          result.applied += 1
          if (writeToFiles) await queueFileWrite(item.bookUuid)
          result.errors.push({
            bookUuid: item.bookUuid,
            message: `Title saved, but moving its asset folder failed: ${describe(error)}`,
          })
        } else {
          result.errors.push({
            bookUuid: item.bookUuid,
            message: describe(error),
          })
          await db
            .deleteFrom("titleCleanupLog")
            .where("id", "=", logId)
            .execute()
        }
      }
    }
  }

  logger.info({
    msg: "Title clean-up applied",
    batchId,
    applied: result.applied,
    skipped: result.skipped,
    errors: result.errors.length,
  })
  return result
}

/** The newest batch that still has titles to put back. */
export async function getLastTitleCleanupBatch(): Promise<TitleCleanupBatch | null> {
  const latest = await db
    .selectFrom("titleCleanupLog")
    .select(["batchId", "appliedAt"])
    .where("undoneAt", "is", null)
    .orderBy("id", "desc")
    .limit(1)
    .executeTakeFirst()
  if (!latest) return null
  const count = await db
    .selectFrom("titleCleanupLog")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("batchId", "=", latest.batchId)
    .where("undoneAt", "is", null)
    .executeTakeFirstOrThrow()
  return {
    batchId: latest.batchId,
    appliedAt: latest.appliedAt,
    count: Number(count.count),
  }
}

/**
 * Puts the old titles back for the latest batch (or the given one), only for
 * books whose title is still the one the clean-up wrote. A title edited since
 * is never overwritten.
 */
export async function undoTitleCleanup(
  batchId?: string,
  { writeToFiles = true }: ApplyOptions = {},
): Promise<TitleCleanupUndoResult> {
  const target = batchId ?? (await getLastTitleCleanupBatch())?.batchId ?? null
  const result: TitleCleanupUndoResult = {
    batchId: target,
    restored: 0,
    skipped: 0,
    errors: [],
  }
  if (!target) return result

  const rows = await db
    .selectFrom("titleCleanupLog")
    .select(["id", "bookUuid", "oldTitle", "newTitle"])
    .where("batchId", "=", target)
    .where("undoneAt", "is", null)
    .orderBy("id", "desc")
    .execute()

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    for (const row of rows.slice(i, i + BATCH_SIZE)) {
      try {
        const book = await getBook(row.bookUuid)
        if (!book || book.title !== row.newTitle) {
          result.skipped += 1
          // Edited since: it can no longer be undone, so close the row.
          await db
            .updateTable("titleCleanupLog")
            .set({ undoneAt: new Date().toISOString() })
            .where("id", "=", row.id)
            .execute()
          continue
        }
        let moveError: unknown = null
        try {
          await updateBook(row.bookUuid, { title: row.oldTitle })
        } catch (error) {
          // The title is saved before the asset folder moves, see apply.
          const now = await getBook(row.bookUuid).catch(() => null)
          if (now?.title !== row.oldTitle) throw error
          moveError = error
        }
        await db
          .updateTable("titleCleanupLog")
          .set({ undoneAt: new Date().toISOString() })
          .where("id", "=", row.id)
          .execute()
        result.restored += 1
        if (writeToFiles) await queueFileWrite(row.bookUuid)
        if (moveError) {
          result.errors.push({
            bookUuid: row.bookUuid,
            message: `Title restored, but moving its asset folder failed: ${describe(moveError)}`,
          })
        }
      } catch (error) {
        result.errors.push({ bookUuid: row.bookUuid, message: describe(error) })
      }
    }
  }
  return result
}
