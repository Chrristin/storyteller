import { type DriveSyncTally, addBatchToTally } from "@/driveSync"
import { type KindleSentBooks, type KindleSendResponse } from "@/kindle"
import { type UUID } from "@/uuid"

type TitledBook = { uuid: UUID; title: string }

/**
 * Picks the books to send. Unless includeSent is true, books that already have
 * a send record are left out, and counted in leftOut.
 */
export function selectKindleTargets<T extends { uuid: UUID }>(
  books: readonly T[],
  sent: KindleSentBooks | undefined,
  includeSent: boolean,
): { targets: T[]; leftOut: number } {
  if (includeSent || !sent) return { targets: [...books], leftOut: 0 }
  const targets = books.filter((book) => !sent[book.uuid])
  return { targets, leftOut: books.length - targets.length }
}

/** True when every book already has a send record (and there is at least one). */
export function allKindleSent(
  books: readonly { uuid: UUID }[],
  sent: KindleSentBooks | undefined,
) {
  return !!sent && books.length > 0 && books.every((book) => !!sent[book.uuid])
}

/** Adds one server response to the tally, reusing the Drive tally helpers. */
export function addKindleBatchToTally(
  tally: DriveSyncTally,
  response: KindleSendResponse,
  books: readonly TitledBook[],
): DriveSyncTally {
  const titles = new Map(books.map((book) => [book.uuid, book.title]))
  const results = response.results.map((result) => ({
    uuid: result.uuid as UUID,
    title: titles.get(result.uuid as UUID) ?? result.uuid,
    status: result.status,
    ...(result.message && { message: result.message }),
  }))
  return addBatchToTally(tally, {
    sent: response.sent,
    replaced: 0,
    skipped: response.skipped,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  })
}
