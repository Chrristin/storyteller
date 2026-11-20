import { type UUID } from "@/uuid"

import { db } from "./connection"
import { type HardcoverIdentityStatus } from "./schema"
import { bookVisibleTo } from "./shelfFilter"

/**
 * What Hardcover says each book is. See migration 133. Nothing in here changes
 * a book; src/hardcover/apply.ts does that, after the owner accepts.
 */

export type { HardcoverIdentityStatus }

export type IdentityValues = {
  status: HardcoverIdentityStatus
  hardcoverId?: string | null
  matchedTitle?: string | null
  matchedAuthors?: string[] | null
  seriesName?: string | null
  seriesPosition?: number | null
  genres?: string[] | null
  moods?: string[] | null
  error?: string | null
  sourceQuery?: string | null
}

export type IdentifyBook = {
  uuid: UUID
  title: string
  authors: string[]
  seriesNames: string[]
  seriesPositions: number[]
}

export type IdentityCounts = Record<HardcoverIdentityStatus, number> & {
  /** Books in the library without a row yet. */
  unchecked: number
}

function toIso(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value
}

// The database layer already parses JSON text into arrays on read, so accept
// both a parsed array and the raw text.
function parseList(value: unknown): string[] {
  let parsed: unknown = value
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : []
}

/** Books that still need a look: no row yet, or pending, or failed last time. */
export async function listBooksToIdentify(): Promise<UUID[]> {
  const rows = await db
    .selectFrom("book")
    .leftJoin("hardcoverIdentity", "hardcoverIdentity.bookUuid", "book.uuid")
    .select("book.uuid")
    .where((eb) =>
      eb.or([
        eb("hardcoverIdentity.bookUuid", "is", null),
        eb("hardcoverIdentity.status", "in", ["pending", "error"]),
      ]),
    )
    .orderBy("book.createdAt", "asc")
    .execute()
  return rows.map((row) => row.uuid)
}

/** Title, authors and current series of one book, for the lookup. */
export async function getBookForIdentify(
  uuid: UUID,
): Promise<IdentifyBook | null> {
  const book = await db
    .selectFrom("book")
    .select(["uuid", "title"])
    .where("uuid", "=", uuid)
    .executeTakeFirst()
  if (!book) return null

  const creators = await db
    .selectFrom("bookToCreator")
    .innerJoin("creator", "creator.uuid", "bookToCreator.creatorUuid")
    .select(["creator.name", "bookToCreator.role"])
    .where("bookToCreator.bookUuid", "=", uuid)
    .orderBy("bookToCreator.createdAt", "asc")
    .execute()
  const aut = creators.filter((creator) => creator.role === "aut")
  const authors = (
    aut.length > 0 ? aut : creators.filter((creator) => creator.role === null)
  ).map((creator) => creator.name)

  const series = await db
    .selectFrom("bookToSeries")
    .innerJoin("series", "series.uuid", "bookToSeries.seriesUuid")
    .select(["series.name", "bookToSeries.position"])
    .where("bookToSeries.bookUuid", "=", uuid)
    .execute()

  return {
    uuid: book.uuid,
    title: book.title,
    authors,
    seriesNames: series.map((row) => row.name),
    seriesPositions: series
      .map((row) => row.position)
      .filter((position): position is number => position !== null),
  }
}

export async function saveIdentity(bookUuid: UUID, values: IdentityValues) {
  const row = {
    status: values.status,
    hardcoverId: values.hardcoverId ?? null,
    matchedTitle: values.matchedTitle ?? null,
    matchedAuthors: values.matchedAuthors
      ? JSON.stringify(values.matchedAuthors)
      : null,
    seriesName: values.seriesName ?? null,
    seriesPosition: values.seriesPosition ?? null,
    genres: values.genres ? JSON.stringify(values.genres) : null,
    moods: values.moods ? JSON.stringify(values.moods) : null,
    error: values.error ?? null,
    sourceQuery: values.sourceQuery ?? null,
    checkedAt: new Date().toISOString(),
    acceptedAt: null,
  }
  await db
    .insertInto("hardcoverIdentity")
    .values({ bookUuid, ...row })
    .onConflict((oc) => oc.column("bookUuid").doUpdateSet(row))
    .execute()
}

/** "Check everything again": every row that is not accepted goes back to pending. */
export async function resetNonAccepted() {
  await db
    .updateTable("hardcoverIdentity")
    .set({ status: "pending" })
    .where("status", "!=", "accepted")
    .execute()
}

export async function getIdentityCounts(): Promise<IdentityCounts> {
  const rows = await db
    .selectFrom("hardcoverIdentity")
    .select(["status", (eb) => eb.fn.countAll<number>().as("count")])
    .groupBy("status")
    .execute()
  const counts: IdentityCounts = {
    pending: 0,
    sure: 0,
    check: 0,
    none: 0,
    accepted: 0,
    error: 0,
    unchecked: 0,
  }
  for (const row of rows) counts[row.status] = Number(row.count)

  const total = await db
    .selectFrom("book")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirst()
  const identified =
    counts.pending +
    counts.sure +
    counts.check +
    counts.none +
    counts.accepted +
    counts.error
  counts.unchecked = Math.max(0, Number(total?.count ?? 0) - identified)
  return counts
}

export type ReviewItem = {
  bookUuid: UUID
  title: string
  authors: string[]
  currentSeries: string[]
  status: HardcoverIdentityStatus
  suggestedSeries: string | null
  suggestedPosition: number | null
  genres: string[]
  moods: string[]
  matchedTitle: string | null
  matchedAuthors: string[]
  hardcoverId: string | null
  acceptedAt: string | null
}

export type ReviewPage = {
  items: ReviewItem[]
  total: number
  nextCursor: string | null
}

export const REVIEW_PAGE_SIZE = 200

function visibleRows(userId: UUID | undefined) {
  return db
    .selectFrom("hardcoverIdentity")
    .innerJoin("book", "book.uuid", "hardcoverIdentity.bookUuid")
    .$if(!!userId, (qb) =>
      // oxlint-disable-next-line typescript/no-non-null-assertion
      qb.where((eb) => bookVisibleTo(eb, "book.uuid", userId!)),
    )
}

async function hydrate(
  rows: {
    bookUuid: UUID
    title: string
    status: HardcoverIdentityStatus
    seriesName: string | null
    seriesPosition: number | null
    genres: string | null
    moods: string | null
    matchedTitle: string | null
    matchedAuthors: string | null
    hardcoverId: string | null
    acceptedAt: string | null
  }[],
): Promise<ReviewItem[]> {
  if (rows.length === 0) return []
  const uuids = rows.map((row) => row.bookUuid)

  const [creators, series] = await Promise.all([
    db
      .selectFrom("bookToCreator")
      .innerJoin("creator", "creator.uuid", "bookToCreator.creatorUuid")
      .select(["bookToCreator.bookUuid", "creator.name"])
      .where("bookToCreator.bookUuid", "in", uuids)
      .where("bookToCreator.role", "=", "aut")
      .execute(),
    db
      .selectFrom("bookToSeries")
      .innerJoin("series", "series.uuid", "bookToSeries.seriesUuid")
      .select(["bookToSeries.bookUuid", "series.name"])
      .where("bookToSeries.bookUuid", "in", uuids)
      .execute(),
  ])
  const authorsByBook = new Map<string, string[]>()
  for (const row of creators) {
    authorsByBook.set(row.bookUuid, [
      ...(authorsByBook.get(row.bookUuid) ?? []),
      row.name,
    ])
  }
  const seriesByBook = new Map<string, string[]>()
  for (const row of series) {
    seriesByBook.set(row.bookUuid, [
      ...(seriesByBook.get(row.bookUuid) ?? []),
      row.name,
    ])
  }

  return rows.map((row) => ({
    bookUuid: row.bookUuid,
    title: row.title,
    authors: authorsByBook.get(row.bookUuid) ?? [],
    currentSeries: seriesByBook.get(row.bookUuid) ?? [],
    status: row.status,
    suggestedSeries: row.seriesName,
    suggestedPosition: row.seriesPosition,
    genres: parseList(row.genres),
    moods: parseList(row.moods),
    matchedTitle: row.matchedTitle,
    matchedAuthors: parseList(row.matchedAuthors),
    hardcoverId: row.hardcoverId,
    acceptedAt: toIso(row.acceptedAt),
  }))
}

/**
 * One page of suggestions with one status, ordered so books of one suggested
 * series sit together. The cursor is an offset.
 */
export async function listReview(
  status: HardcoverIdentityStatus,
  { cursor, userId }: { cursor?: string | null; userId?: UUID } = {},
): Promise<ReviewPage> {
  const offset = Math.max(0, Number.parseInt(cursor ?? "0", 10) || 0)
  const total = await visibleRows(userId)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("hardcoverIdentity.status", "=", status)
    .executeTakeFirst()

  const rows = await visibleRows(userId)
    .select([
      "hardcoverIdentity.bookUuid",
      "book.title",
      "hardcoverIdentity.status",
      "hardcoverIdentity.seriesName",
      "hardcoverIdentity.seriesPosition",
      "hardcoverIdentity.genres",
      "hardcoverIdentity.moods",
      "hardcoverIdentity.matchedTitle",
      "hardcoverIdentity.matchedAuthors",
      "hardcoverIdentity.hardcoverId",
      "hardcoverIdentity.acceptedAt",
    ])
    .where("hardcoverIdentity.status", "=", status)
    .orderBy("hardcoverIdentity.seriesName", "asc")
    .orderBy("hardcoverIdentity.seriesPosition", "asc")
    .orderBy("book.title", "asc")
    .limit(REVIEW_PAGE_SIZE)
    .offset(offset)
    .execute()

  const count = Number(total?.count ?? 0)
  const next = offset + rows.length
  return {
    items: await hydrate(rows),
    total: count,
    nextCursor: next < count ? String(next) : null,
  }
}

const REVIEW_COLUMNS = [
  "hardcoverIdentity.bookUuid",
  "book.title",
  "hardcoverIdentity.status",
  "hardcoverIdentity.seriesName",
  "hardcoverIdentity.seriesPosition",
  "hardcoverIdentity.genres",
  "hardcoverIdentity.moods",
  "hardcoverIdentity.matchedTitle",
  "hardcoverIdentity.matchedAuthors",
  "hardcoverIdentity.hardcoverId",
  "hardcoverIdentity.acceptedAt",
] as const

/**
 * The rows of the given books that are 'check' or 'sure' right now and that
 * the user may see, for "Accept N selected". Any other book is left out.
 */
export async function listItemsForBooks(
  bookUuids: UUID[],
  userId?: UUID,
): Promise<ReviewItem[]> {
  if (bookUuids.length === 0) return []
  const rows: Parameters<typeof hydrate>[0] = []
  for (let i = 0; i < bookUuids.length; i += 500) {
    rows.push(
      ...(await selectReviewRows(userId)
        .where("hardcoverIdentity.bookUuid", "in", bookUuids.slice(i, i + 500))
        .where("hardcoverIdentity.status", "in", ["check", "sure"])
        .execute()),
    )
  }
  return await hydrate(rows)
}

function selectReviewRows(userId: UUID | undefined) {
  return visibleRows(userId)
    .select([...REVIEW_COLUMNS])
    .orderBy("hardcoverIdentity.seriesName", "asc")
    .orderBy("book.title", "asc")
}

/** Every 'sure' row the user may see, for Accept all. */
export async function listSureItems(userId?: UUID): Promise<ReviewItem[]> {
  const rows = await visibleRows(userId)
    .select([
      "hardcoverIdentity.bookUuid",
      "book.title",
      "hardcoverIdentity.status",
      "hardcoverIdentity.seriesName",
      "hardcoverIdentity.seriesPosition",
      "hardcoverIdentity.genres",
      "hardcoverIdentity.moods",
      "hardcoverIdentity.matchedTitle",
      "hardcoverIdentity.matchedAuthors",
      "hardcoverIdentity.hardcoverId",
      "hardcoverIdentity.acceptedAt",
    ])
    .where("hardcoverIdentity.status", "=", "sure")
    .orderBy("hardcoverIdentity.seriesName", "asc")
    .orderBy("book.title", "asc")
    .execute()
  return await hydrate(rows)
}

export async function markAccepted(
  bookUuids: UUID[],
  fromStatuses: HardcoverIdentityStatus[] = ["sure"],
) {
  if (bookUuids.length === 0) return
  await db
    .updateTable("hardcoverIdentity")
    .set({ status: "accepted", acceptedAt: new Date().toISOString() })
    .where("bookUuid", "in", bookUuids)
    .where("status", "in", fromStatuses)
    .execute()
}
