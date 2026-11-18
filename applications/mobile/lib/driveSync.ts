/**
 * Pure helpers for "Sync to Google Drive": splitting a selection into batches
 * the server accepts and turning the results into text for the user.
 */

/** The server rejects more books than this in one request. */
export const DRIVE_BATCH_SIZE = 25

export type DriveStatus = "sent" | "replaced" | "skipped" | "failed"

export interface DriveResult {
  uuid: string
  title: string
  status: DriveStatus
  message?: string | undefined
}

export function chunkBooks<T>(items: readonly T[], size = DRIVE_BATCH_SIZE) {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many
}

export function summarizeDriveResults(results: readonly DriveResult[]) {
  const count = (status: DriveStatus) =>
    results.filter((result) => result.status === status).length
  const sent = count("sent")
  const replaced = count("replaced")
  const skipped = count("skipped")
  const failed = results.filter((result) => result.status === "failed")

  const parts: string[] = []
  if (sent) parts.push(`${sent} sent`)
  if (replaced) parts.push(`${replaced} replaced`)
  if (skipped) {
    parts.push(
      `${skipped} skipped because ${plural(skipped, "it was", "they were")} already in Drive`,
    )
  }
  if (failed.length) parts.push(`${failed.length} failed`)

  const summary = parts.length ? parts.join(", ") : "Nothing was sent"
  const failures = failed.map(
    (result) =>
      `${result.title}: ${result.message ?? "Could not copy this book"}`,
  )
  const message = failures.length
    ? `${summary}\n\n${failures.join("\n")}`
    : summary

  return { summary, failures, message }
}

/** Reads the server's `{ message }` out of a failed request, if there is one. */
export function driveErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = (error as { data?: unknown }).data
    if (typeof data === "object" && data !== null) {
      const message = (data as { message?: unknown }).message
      if (typeof message === "string" && message) return message
    }
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message) return message
    const status = (error as { status?: unknown }).status
    if (status === "FETCH_ERROR") return "Could not reach the server"
  }
  return "Something went wrong while copying to Drive"
}

/** "just now", "5 minutes ago", "3 days ago". Null when the date is unusable. */
export function relativeAge(
  value: string | number | Date | null | undefined,
  now: number = Date.now(),
) {
  if (value === null || value === undefined) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  const minutes = Math.floor((now - time) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60)
    return `${minutes} ${plural(minutes, "minute", "minutes")} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${plural(hours, "hour", "hours")} ago`
  const days = Math.floor(hours / 24)
  return `${days} ${plural(days, "day", "days")} ago`
}

/** Text for "Copied ..." under a book that is already on Drive. */
export function describeSyncedAt(
  syncedAt: string | number | Date | null | undefined,
  now: number = Date.now(),
) {
  const age = relativeAge(syncedAt, now)
  return age === null ? "On Drive" : `Copied ${age}`
}
