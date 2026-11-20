import assert from "node:assert"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, it } from "vitest"

import { setupTestDb } from "@/__tests__/harness/testDb"

const MIGRATION = readFileSync(
  join(process.cwd(), "migrations", "137_epub2_conversion_default.sql"),
  "utf-8",
)

function setting(ctx: ReturnType<typeof setupTestDb>, name: string) {
  const row = ctx.sqlite
    .prepare(`SELECT value FROM settings WHERE name = ?`)
    .get(name) as { value: string } | undefined
  return row?.value
}

function setSetting(
  ctx: ReturnType<typeof setupTestDb>,
  name: string,
  value: string,
) {
  ctx.sqlite.prepare(`DELETE FROM settings WHERE name = ?`).run(name)
  ctx.sqlite
    .prepare(`INSERT INTO settings (name, value) VALUES (?, ?)`)
    .run(name, value)
}

describe("migration 137, EPUB 2 conversion by default", () => {
  it("turns a global skip into backup-and-convert", () => {
    const ctx = setupTestDb()
    setSetting(ctx, "epub2ImportStrategy", '"skip"')
    ctx.sqlite.exec(MIGRATION)
    assert.strictEqual(
      setting(ctx, "epub2ImportStrategy"),
      '"backup-and-convert"',
    )
  })

  it("leaves other choices alone", () => {
    for (const choice of [
      "replace",
      "convert-alongside",
      "backup-and-convert",
    ]) {
      const ctx = setupTestDb()
      setSetting(ctx, "epub2ImportStrategy", JSON.stringify(choice))
      ctx.sqlite.exec(MIGRATION)
      assert.strictEqual(
        setting(ctx, "epub2ImportStrategy"),
        JSON.stringify(choice),
      )
    }
  })

  it("clears a folder rule set to skip and keeps the others", () => {
    const ctx = setupTestDb()
    const insert = ctx.sqlite.prepare(
      `INSERT INTO import_rule (kind, path, epub2_import_strategy) VALUES ('watch', ?, ?)`,
    )
    insert.run("/a", "skip")
    insert.run("/b", "replace")
    insert.run("/c", null)
    ctx.sqlite.exec(MIGRATION)
    const rows = ctx.sqlite
      .prepare(
        `SELECT path, epub2_import_strategy AS s FROM import_rule ORDER BY path`,
      )
      .all() as { path: string; s: string | null }[]
    assert.deepStrictEqual(
      rows.map((r) => [r.path, r.s]),
      [
        ["/a", null],
        ["/b", "replace"],
        ["/c", null],
      ],
    )
  })

  it("is harmless when the setting does not exist", () => {
    const ctx = setupTestDb()
    ctx.sqlite
      .prepare(`DELETE FROM settings WHERE name = 'epub2ImportStrategy'`)
      .run()
    ctx.sqlite.exec(MIGRATION)
    assert.strictEqual(setting(ctx, "epub2ImportStrategy"), undefined)
  })
})
