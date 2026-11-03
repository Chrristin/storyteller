import { type ScheduledTask } from "node-cron"

import { runBookLinker } from "@/bookLinker"
import { logger } from "@/logging"

/**
 * Runs the book linker once a day (03:30 server time by default).
 *
 * STORYTELLER_AUTO_LINK=false turns it off.
 * STORYTELLER_AUTO_LINK_CRON overrides the schedule.
 */
export const DEFAULT_AUTO_LINK_CRON = "30 3 * * *"

export class BookLinkScheduler {
  private task: ScheduledTask | null = null

  async refresh(): Promise<void> {
    await this.stop()

    if (process.env["STORYTELLER_AUTO_LINK"] === "false") {
      logger.info("Automatic ebook and audiobook linking is disabled")
      return
    }

    const expression =
      process.env["STORYTELLER_AUTO_LINK_CRON"] || DEFAULT_AUTO_LINK_CRON

    // Dynamic import, as in the backup scheduler, to keep it out of the worker bundle.
    const cron = await import("node-cron")

    this.task = cron.schedule(
      expression,
      async () => {
        try {
          await runBookLinker()
        } catch (error) {
          logger.error({ msg: "Scheduled book linking failed", err: error })
        }
      },
      { name: "book-linker", noOverlap: true },
    )

    logger.info(`Automatic book linking scheduled (cron: ${expression})`)
  }

  async stop(): Promise<void> {
    if (!this.task) return
    await this.task.stop()
    this.task = null
  }
}

declare global {
  // eslint-disable-next-line no-var
  var bookLinkSchedulerInstance: BookLinkScheduler | undefined
}

export function getBookLinkScheduler(): BookLinkScheduler {
  if (!globalThis.bookLinkSchedulerInstance) {
    globalThis.bookLinkSchedulerInstance = new BookLinkScheduler()
  }
  return globalThis.bookLinkSchedulerInstance
}
