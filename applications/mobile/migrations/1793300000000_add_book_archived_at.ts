import { type Kysely } from "kysely"

/** When the book was moved to the Archive on the server, null if it was not. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("book").addColumn("archivedAt", "text").execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("book").dropColumn("archivedAt").execute()
}
