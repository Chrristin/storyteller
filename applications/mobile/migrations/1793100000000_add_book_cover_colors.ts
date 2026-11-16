import { type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("book")
    .addColumn("textCoverColor", "text")
    .execute()
  await db.schema
    .alterTable("book")
    .addColumn("audioCoverColor", "text")
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("book").dropColumn("textCoverColor").execute()
  await db.schema.alterTable("book").dropColumn("audioCoverColor").execute()
}
