import { type Kysely } from "kysely"

import { type DB } from "@/database/schema"
import { randomUUID } from "@/uuid"

/**
 * The server now has a separate "Unread" status for books that only arrived.
 * Add it here too, so it can be picked in menus. It is not the phone's local
 * default: books from the server keep the status the server gave them.
 */
export async function up(db: Kysely<DB>): Promise<void> {
  const existing = await db
    .selectFrom("status")
    .select("uuid")
    .where("name", "=", "Unread")
    .executeTakeFirst()

  if (existing) return

  await db
    .insertInto("status")
    .values({ uuid: randomUUID(), name: "Unread", isDefault: "false" })
    .execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.deleteFrom("status").where("name", "=", "Unread").execute()
}
