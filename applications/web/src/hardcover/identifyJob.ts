import {
  getBookForIdentify,
  listBooksToIdentify,
  resetNonAccepted,
  saveIdentity,
} from "@/database/hardcoverIdentity"
import { readHardcoverToken } from "@/database/providerTokens"
import { logger } from "@/logging"

import {
  HardcoverAuthError,
  HardcoverRateLimitError,
  searchHardcover,
} from "./client"
import { type HardcoverDoc, cleanLibraryTitle, matchBook } from "./match"

/**
 * Looks books up on Hardcover in the background, one book per tick, about 1.4
 * seconds apart (the free tier allows about one request a second). State lives
 * in the module, like the library tidy scheduler. The results live in the
 * hardcover_identity table, so a restart loses only the running flag. A run is
 * never started on its own at server start.
 */

export const PACE_MS = 1_400
const MAX_CONSECUTIVE_FAILURES = 3

export type IdentifyMode = "new" | "all"

export type IdentifyProgress = {
  running: boolean
  total: number
  done: number
  sure: number
  check: number
  none: number
  error: number
  startedAt: string | null
  lastError: string | null
}

export type IdentifyDeps = {
  getToken: () => Promise<string | null>
  search: (token: string, query: string) => Promise<HardcoverDoc[]>
  sleep: (ms: number) => Promise<void>
  paceMs: number
}

function emptyProgress(): IdentifyProgress {
  return {
    running: false,
    total: 0,
    done: 0,
    sure: 0,
    check: 0,
    none: 0,
    error: 0,
    startedAt: null,
    lastError: null,
  }
}

type JobState = {
  progress: IdentifyProgress
  stopRequested: boolean
  wake: (() => void) | null
}

declare global {
  // eslint-disable-next-line no-var
  var hardcoverIdentifyState: JobState | undefined
}

function state(): JobState {
  globalThis.hardcoverIdentifyState ??= {
    progress: emptyProgress(),
    stopRequested: false,
    wake: null,
  }
  return globalThis.hardcoverIdentifyState
}

export function getIdentifyProgress(): IdentifyProgress {
  return { ...state().progress }
}

export function isIdentifyRunning() {
  return state().progress.running
}

const defaultDeps: IdentifyDeps = {
  getToken: async () => (await readHardcoverToken()).token,
  search: (token, query) => searchHardcover(token, query),
  sleep: (ms) =>
    new Promise<void>((resolve) => {
      const s = state()
      const timer = setTimeout(() => {
        s.wake = null
        resolve()
      }, ms)
      // A stop request wakes the sleeper straight away.
      s.wake = () => {
        clearTimeout(timer)
        s.wake = null
        resolve()
      }
    }),
  paceMs: PACE_MS,
}

/** The only text that leaves the server: the title and the first author. */
export function buildQuery(
  title: string,
  authors: string[],
  seriesPositions?: number[],
) {
  // Same noise stripping as the matcher: "(Unabridged)", a zero padded track
  // number, a number equal to the series position, then any other brackets.
  const cleaned = cleanLibraryTitle(title, seriesPositions).replace(
    /\([^)]*\)|\[[^\]]*\]/g,
    " ",
  )
  return [cleaned, authors[0] ?? ""].join(" ").replace(/\s+/g, " ").trim()
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}

/**
 * Runs the whole job and resolves when it ends. Exported for tests, which pass
 * their own dependencies. Use startIdentify from the app.
 */
export async function runIdentify(
  mode: IdentifyMode,
  deps: IdentifyDeps = defaultDeps,
): Promise<IdentifyProgress> {
  const s = state()
  const progress = s.progress
  Object.assign(progress, emptyProgress(), {
    running: true,
    startedAt: new Date().toISOString(),
  })
  s.stopRequested = false

  try {
    const token = await deps.getToken()
    if (!token) {
      progress.lastError =
        "There is no Hardcover token yet. Add one in Settings, Metadata."
      return progress
    }

    if (mode === "all") await resetNonAccepted()
    const uuids = await listBooksToIdentify()
    progress.total = uuids.length

    let failures = 0
    let first = true
    for (const uuid of uuids) {
      if (s.stopRequested) break

      const book = await getBookForIdentify(uuid)
      if (!book?.title.trim()) {
        // A book without a title is skipped.
        progress.done += 1
        continue
      }

      if (!first) await deps.sleep(deps.paceMs)
      first = false
      if (s.stopRequested) break

      const query = buildQuery(book.title, book.authors, book.seriesPositions)
      try {
        const docs = await deps.search(token, query)
        const match = matchBook(
          {
            title: book.title,
            authors: book.authors,
            seriesNames: book.seriesNames,
            seriesPositions: book.seriesPositions,
          },
          docs,
        )
        const suggestion = match.suggestion
        await saveIdentity(uuid, {
          status: match.confidence,
          hardcoverId: suggestion?.hardcoverId ?? null,
          matchedTitle: suggestion?.matchedTitle ?? null,
          matchedAuthors: suggestion?.matchedAuthors ?? null,
          seriesName: suggestion?.series.name ?? null,
          seriesPosition: suggestion?.series.position ?? null,
          genres: suggestion?.genres ?? null,
          moods: suggestion?.moods ?? null,
          sourceQuery: query,
        })
        progress[match.confidence] += 1
        failures = 0
      } catch (error) {
        if (error instanceof HardcoverAuthError) {
          progress.lastError = error.message
          break
        }
        failures += 1
        progress.error += 1
        progress.lastError = describe(error)
        await saveIdentity(uuid, {
          status: "error",
          error: describe(error),
          sourceQuery: query,
        })
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          progress.lastError =
            error instanceof HardcoverRateLimitError
              ? "Hardcover keeps saying too many requests. Try again in a few minutes."
              : `Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row. ${describe(error)}`
          break
        }
      }
      progress.done += 1
    }
  } catch (error) {
    progress.lastError = describe(error)
    logger.error({ msg: "Hardcover identify failed", err: error })
  } finally {
    progress.running = false
  }
  return progress
}

/** Starts a run in the background. Refuses when one is already running. */
export function startIdentify(
  mode: IdentifyMode,
  deps?: IdentifyDeps,
): { started: boolean } {
  if (state().progress.running) return { started: false }
  // Mark running before the first await, so a second call cannot slip in.
  state().progress.running = true
  void runIdentify(mode, deps).catch((error: unknown) => {
    logger.error({ msg: "Hardcover identify crashed", err: error })
    state().progress.running = false
  })
  return { started: true }
}

export function stopIdentify() {
  const s = state()
  if (!s.progress.running) return
  s.stopRequested = true
  s.wake?.()
}
