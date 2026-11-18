import { type UUID } from "@/uuid"

import { db } from "./connection"

export type KindleSendRecord = { sentAt: string; address: string | null }

// The database layer may hand back a Date for ISO strings, so always return
// a string.
function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value
}

export async function recordKindleSends(
  userId: UUID,
  bookUuids: UUID[],
  address: string | null,
) {
  if (bookUuids.length === 0) return
  const sentAt = new Date().toISOString()
  await db
    .insertInto("bookKindleSend")
    .values(
      bookUuids.map((bookUuid) => ({ userId, bookUuid, sentAt, address })),
    )
    .onConflict((oc) =>
      oc.columns(["userId", "bookUuid"]).doUpdateSet({ sentAt, address }),
    )
    .execute()
}

export async function getKindleSends(
  userId: UUID,
  bookUuids: UUID[],
): Promise<Map<UUID, KindleSendRecord>> {
  if (bookUuids.length === 0) return new Map()
  const rows = await db
    .selectFrom("bookKindleSend")
    .selectAll()
    .where("userId", "=", userId)
    .where("bookUuid", "in", bookUuids)
    .execute()
  return new Map(
    rows.map((row) => [
      row.bookUuid,
      { sentAt: toIso(row.sentAt), address: row.address },
    ]),
  )
}
