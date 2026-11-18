/**
 * Pure helpers for "Send to Kindle": batching, error text and summaries, plus
 * the rule for which books of a mixed selection an action applies to.
 */

import { chunkBooks, relativeAge } from "./driveSync"

/** The server rejects more books than this in one email. */
export const KINDLE_BATCH_SIZE = 25

export function kindleBatches<T>(items: readonly T[]) {
  return chunkBooks(items, KINDLE_BATCH_SIZE)
}

const KINDLE_ERROR_MESSAGES: Record<string, string> = {
  "too-large": "These books are too big to send in one email. Select fewer.",
  "too-many": "Too many books for one email. Select fewer.",
  "no-kindle-address":
    "No Kindle address saved. Add one in Preferences on the web.",
  "smtp-not-configured": "The server cannot send email yet.",
}

/** Plain English for a failed Send to Kindle request. */
export function kindleErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = (error as { data?: unknown }).data
    if (typeof data === "object" && data !== null) {
      const code = (data as { code?: unknown }).code
      if (typeof code === "string" && KINDLE_ERROR_MESSAGES[code]) {
        return KINDLE_ERROR_MESSAGES[code]
      }
      const message = (data as { message?: unknown }).message
      if (typeof message === "string" && message) return message
    }
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message) return message
    if ((error as { status?: unknown }).status === "FETCH_ERROR") {
      return "Could not reach the server"
    }
  }
  return "Something went wrong while sending to your Kindle"
}

export function summarizeKindleSend(sent: number, skipped: number) {
  const noun = (count: number) => (count === 1 ? "book" : "books")
  const parts: string[] = []
  if (sent) parts.push(`${sent} ${noun(sent)} sent to your Kindle`)
  if (skipped) {
    parts.push(
      `${skipped} ${noun(skipped)} skipped because ${skipped === 1 ? "it has" : "they have"} no ebook`,
    )
  }
  return parts.length ? parts.join(", ") : "Nothing was sent"
}

/** What was already sent, then why it stopped. */
export function describeKindleStop(
  sent: number,
  skipped: number,
  error: unknown,
) {
  const done = sent
    ? `${summarizeKindleSend(sent, skipped)} before it stopped. `
    : ""
  return `${done}${kindleErrorMessage(error)}`
}

export interface ActionSplit<T> {
  /** Books on servers where the action is available. */
  included: T[]
  /** Books on other servers, which the action leaves out. */
  excluded: T[]
}

export function splitByServers<T extends { serverUuid: string }>(
  books: readonly T[],
  available: ReadonlySet<string>,
): ActionSplit<T> {
  const included: T[] = []
  const excluded: T[] = []
  for (const book of books) {
    ;(available.has(book.serverUuid) ? included : excluded).push(book)
  }
  return { included, excluded }
}

/** Confirmation text for an action, naming any books it will leave out. */
export function describeActionScope(
  action: string,
  included: number,
  excluded: number,
) {
  const noun = (count: number) => (count === 1 ? "book" : "books")
  const base = `${action} ${included} ${noun(included)}?`
  if (!excluded) return base
  return `${base} ${excluded} selected ${noun(excluded)} ${excluded === 1 ? "is" : "are"} on a server where this is not available and will be left out.`
}

/** Text for "Sent ..." on a book that was already sent to the Kindle. */
export function describeSentAt(
  sentAt: string | number | Date | null | undefined,
  now: number = Date.now(),
) {
  const age = relativeAge(sentAt, now)
  return age === null ? "Sent" : `Sent ${age}`
}

export interface KindleResult {
  uuid: string
  status: "sent" | "skipped" | "failed"
  message?: string | undefined
}

/** Which books to send: all of them when resending, else only the unsent. */
export function selectKindleBooks<T extends { uuid: string }>(
  books: readonly T[],
  sent: ReadonlySet<string>,
  resend: boolean,
): T[] {
  return resend ? [...books] : books.filter((book) => !sent.has(book.uuid))
}

/**
 * State of the "Also resend books already sent" row. It shows only when some
 * eligible book was already sent, and starts ticked when all of them were.
 */
export function kindleResendState(
  uuids: readonly string[],
  sent: ReadonlySet<string>,
) {
  const sentCount = uuids.filter((uuid) => sent.has(uuid)).length
  return {
    showCheckbox: sentCount > 0,
    defaultResend: uuids.length > 0 && sentCount === uuids.length,
  }
}

/** Label for the Kindle button, given how many books it will send. */
export function kindleButtonLabel(count: number, resend: boolean) {
  const action = resend ? "Resend" : "Send"
  return { action, button: `${action} ${count} to Kindle` }
}

/** Text for the busy button, like "Sending 25 of 60". */
export function kindleProgressLabel(done: number, total: number) {
  return `Sending ${done} of ${total}`
}

/**
 * Plain English summary of a send. Uses the per book results when the server
 * gave them; counts from an older server (sent and skipped only) are added.
 */
export function summarizeKindleResults(
  results: readonly KindleResult[],
  titles: ReadonlyMap<string, string>,
  legacy: { sent: number; skipped: number } = { sent: 0, skipped: 0 },
) {
  const count = (status: KindleResult["status"]) =>
    results.filter((result) => result.status === status).length
  const sent = count("sent") + legacy.sent
  const skipped = count("skipped") + legacy.skipped
  const failed = results.filter((result) => result.status === "failed")

  const parts: string[] = []
  if (sent) parts.push(`${sent} sent`)
  if (skipped) {
    parts.push(
      `${skipped} skipped because ${skipped === 1 ? "it has" : "they have"} no ebook`,
    )
  }
  if (failed.length) parts.push(`${failed.length} failed`)

  const summary = parts.length ? parts.join(", ") : "Nothing was sent"
  const failures = failed.map(
    (result) =>
      `${titles.get(result.uuid) ?? "A book"}: ${result.message ?? "Could not send this book"}`,
  )
  const message = failures.length
    ? `${summary}\n\n${failures.join("\n")}`
    : summary
  return { summary, failures, message, sent, skipped, failed: failed.length }
}
