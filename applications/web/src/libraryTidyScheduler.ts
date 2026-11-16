import { type ScheduledTask } from "node-cron"

import { runTidy } from "@/libraryTidy"
import { logger } from "@/logging"

/**
 * Runs the library tidy once a day (04:00 server time by default) and, through
 * requestTidyAfterScan, a little while after a scan adds books.
 *
 * By default it only PREVIEWS: it logs the merges it would make and changes
 * nothing, because merges cannot be undone. Look at the plan first (GET
 * /api/v2/library/tidy, or the container log), then set
 * STORYTELLER_AUTO_TIDY=apply to let it merge.
 *
 * STORYTELLER_AUTO_TIDY=false turns both runs off.
 * STORYTELLER_AUTO_TIDY_CRON overrides the nightly schedule.
 */
export const DEFAULT_AUTO_TIDY_CRON = "0 4 * * *"
export const TIDY_MIN_INTERVAL_MS = 10 * 60 * 1000
export const TIDY_SETTLE_MS = 60 * 1000

export function isAutoTidyEnabled(): boolean {
  return process.env["STORYTELLER_AUTO_TIDY"] !== "false"
}

/** Merges only when the owner has asked for it with STORYTELLER_AUTO_TIDY=apply. */
export function autoTidyApplies(): boolean {
  return process.env["STORYTELLER_AUTO_TIDY"] === "apply"
}

async function safeRunTidy(reason: string) {
  try {
    const apply = autoTidyApplies()
    const result = await runTidy({ dryRun: !apply })
    if (!apply && result.merges.length > 0) {
      logger.info({
        msg: `Library tidy preview (${reason}): ${result.merges.length} merge(s) would be made. Nothing was changed. Set STORYTELLER_AUTO_TIDY=apply to merge.`,
        merges: result.merges.map((merge) => ({
          kind: merge.kind,
          target: merge.target.name,
          sources: merge.sources.map((source) => source.name),
        })),
      })
    }
  } catch (error) {
    logger.error({ msg: `Library tidy failed (${reason})`, err: error })
  }
}

export class LibraryTidyScheduler {
  private task: ScheduledTask | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastRun = 0
  private running = false

  async refresh(): Promise<void> {
    await this.stop()

    if (!isAutoTidyEnabled()) {
      logger.info("Automatic library tidy is disabled")
      return
    }

    const expression =
      process.env["STORYTELLER_AUTO_TIDY_CRON"] || DEFAULT_AUTO_TIDY_CRON

    const cron = await import("node-cron")

    this.task = cron.schedule(
      expression,
      async () => {
        await this.run("nightly")
      },
      { name: "library-tidy", noOverlap: true },
    )

    logger.info(`Automatic library tidy scheduled (cron: ${expression})`)
  }

  /**
   * Asks for a tidy soon after books were added. Repeated calls while one is
   * pending do nothing, and runs are at least ten minutes apart, so a bulk
   * import triggers a single run.
   */
  requestAfterScan(now = Date.now()): void {
    if (!isAutoTidyEnabled() || this.timer) return
    const wait = Math.max(
      TIDY_SETTLE_MS,
      this.lastRun + TIDY_MIN_INTERVAL_MS - now,
    )
    this.timer = setTimeout(() => {
      this.timer = null
      void this.run("after scan")
    }, wait)
    this.timer.unref()
  }

  private async run(reason: string) {
    if (this.running) return
    this.running = true
    try {
      await safeRunTidy(reason)
    } finally {
      this.lastRun = Date.now()
      this.running = false
    }
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.task) return
    await this.task.stop()
    this.task = null
  }
}

declare global {
  // eslint-disable-next-line no-var
  var libraryTidySchedulerInstance: LibraryTidyScheduler | undefined
}

export function getLibraryTidyScheduler(): LibraryTidyScheduler {
  if (!globalThis.libraryTidySchedulerInstance) {
    globalThis.libraryTidySchedulerInstance = new LibraryTidyScheduler()
  }
  return globalThis.libraryTidySchedulerInstance
}
