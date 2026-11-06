import { type Generated, type Kysely } from "kysely"

import { type ColorTheme } from "@/database/preferencesTypes"
import { type UUID } from "@/uuid"

/**
 * Reading themes chosen for long reading: softer than pure white on pure black.
 * Contrast is roughly 10:1 to 13:1 instead of the maximum 21:1.
 */
export const COMFORT_THEMES: ColorTheme[] = [
  {
    name: "Dark Grey",
    foreground: "#d6d6d6",
    background: "#121212",
    isDark: true,
  },
  {
    name: "Soft Grey",
    foreground: "#c8c8c8",
    background: "#1a1a1a",
    isDark: true,
  },
  {
    name: "Warm Dark",
    foreground: "#cfc6b8",
    background: "#1b1815",
    isDark: true,
  },
  {
    name: "OLED Black",
    foreground: "#bdbdbd",
    background: "#000000",
    isDark: true,
  },
  {
    name: "Paper",
    foreground: "#222222",
    background: "#fbfaf7",
    isDark: false,
  },
  {
    name: "Soft Sepia",
    foreground: "#3b3226",
    background: "#f4ecd8",
    isDark: false,
  },
]

function parseThemes(value: unknown): ColorTheme[] {
  return (typeof value === "string" ? JSON.parse(value) : value) as ColorTheme[]
}

export async function up(db: Kysely<DB>): Promise<void> {
  await db.transaction().execute(async (tr) => {
    const row = await tr
      .selectFrom("preferences")
      .select("value")
      .where("name", "=", "colorThemes")
      .executeTakeFirst()
    if (!row) return

    const themes = parseThemes(row.value)
    // A theme with the same name that the user already has is left as it is.
    const missing = COMFORT_THEMES.filter(
      (theme) => !themes.some((existing) => existing.name === theme.name),
    )
    if (!missing.length) return

    await tr
      .updateTable("preferences")
      .set({ value: JSON.stringify([...themes, ...missing]) })
      .where("name", "=", "colorThemes")
      .execute()
  })
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.transaction().execute(async (tr) => {
    const row = await tr
      .selectFrom("preferences")
      .select("value")
      .where("name", "=", "colorThemes")
      .executeTakeFirst()
    if (!row) return

    const names = new Set(COMFORT_THEMES.map((theme) => theme.name))
    const themes = parseThemes(row.value).filter(
      (theme) => !names.has(theme.name),
    )
    await tr
      .updateTable("preferences")
      .set({ value: JSON.stringify(themes) })
      .where("name", "=", "colorThemes")
      .execute()
  })
}

type PreferenceName = "colorThemes"

interface Preferences {
  createdAt: Generated<string>
  id: number | null
  name: PreferenceName
  updatedAt: Generated<string>
  uuid: UUID
  value: string
}

interface DB {
  preferences: Preferences
}
