import { type TiltLevel, TILT_LEVELS } from "./tilt"

/** The choices behind the "Library look" section of Settings. */
export type LibraryLook = {
  /** How far covers lean in lists. */
  tilt: TiltLevel
  /** Show the title and author under covers in grids and shelves. */
  showTitles: boolean
  /** Fill the space around a square audiobook cover with a blurred copy. */
  blurFill: boolean
  /** Show the currently reading card and round covers on the home screen. */
  showCurrentlyReading: boolean
}

export const DEFAULT_LIBRARY_LOOK: LibraryLook = {
  tilt: "subtle",
  showTitles: false,
  blurFill: true,
  showCurrentlyReading: true,
}

/** Turn whatever was stored into a full, valid set of choices. */
export function normalizeLibraryLook(raw: unknown): LibraryLook {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof LibraryLook, unknown>
  >
  const d = DEFAULT_LIBRARY_LOOK
  return {
    tilt: TILT_LEVELS.includes(value.tilt as TiltLevel)
      ? (value.tilt as TiltLevel)
      : d.tilt,
    showTitles:
      typeof value.showTitles === "boolean" ? value.showTitles : d.showTitles,
    blurFill: typeof value.blurFill === "boolean" ? value.blurFill : d.blurFill,
    showCurrentlyReading:
      typeof value.showCurrentlyReading === "boolean"
        ? value.showCurrentlyReading
        : d.showCurrentlyReading,
  }
}
