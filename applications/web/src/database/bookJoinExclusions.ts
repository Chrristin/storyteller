import { type Kysely, sql } from "kysely"

import { db } from "@/database/connection"
import { type DB } from "@/database/schema"
import { type UUID } from "@/uuid"

/**
 * Pairs of books the linker must never join. The pair is stored in a
 * canonical order, so (a, b) and (b, a) are the same row.
 */
export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/** The key used in the exclusion set, the same for either argument order. */
export function joinPairKey(a: string, b: string): string {
  const [first, second] = canonicalPair(a, b)
  return `${first}|${second}`
}

// Raw SQL on purpose: the camel-case plugin turns `bookAUuid` into
// `book_auuid`, not `book_a_uuid`.
export async function loadJoinExclusions(
  executor: Kysely<DB> = db,
): Promise<Set<string>> {
  const { rows } = await sql<{ a: string; b: string }>`
    SELECT book_a_uuid AS a, book_b_uuid AS b FROM book_join_exclusion`.execute(
    executor,
  )
  return new Set(rows.map((row) => joinPairKey(row.a, row.b)))
}

export async function addJoinExclusion(executor: Kysely<DB>, a: UUID, b: UUID) {
  const [first, second] = canonicalPair(a, b)
  await sql`INSERT INTO book_join_exclusion (book_a_uuid, book_b_uuid)
    VALUES (${first}, ${second})
    ON CONFLICT (book_a_uuid, book_b_uuid) DO NOTHING`.execute(executor)
}

export async function removeJoinExclusion(
  executor: Kysely<DB>,
  a: UUID,
  b: UUID,
) {
  const [first, second] = canonicalPair(a, b)
  await sql`DELETE FROM book_join_exclusion
    WHERE book_a_uuid = ${first} AND book_b_uuid = ${second}`.execute(executor)
}
