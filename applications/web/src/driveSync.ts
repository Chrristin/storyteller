import { type UUID } from "@/uuid"

/**
 * Client-side helpers for syncing books to Google Drive. The server accepts at
 * most this many books per request (DRIVE_MAX_BOOKS_PER_REQUEST in the sync
 * route), so larger selections are sent in sequential batches.
 */
export const DRIVE_BATCH_SIZE = 25

export const DRIVE_CALLBACK_PATH = "/api/v2/drive/callback"

export type DriveStatus = {
  configured: boolean
  connected: boolean
  accountEmail: string | null
}

/** What the signed-in user can send ebooks to, from GET /api/v2/delivery. */
export type DeliveryStatus = {
  drive: DriveStatus
  kindle: {
    smtpConfigured: boolean
    hasAddress: boolean
    defaultAddress: string | null
    available: boolean
  }
}

export const DRIVE_PREFERENCES_PATH =
  "/preferences?tab=devices&section=googleDrive"

export type DriveBookFiles = Record<
  string,
  { syncedAt: string; fileName: string }
>

export type DriveSyncStatus = "sent" | "replaced" | "skipped" | "failed"

export type DriveSyncBookResult = {
  uuid: UUID
  title: string
  status: DriveSyncStatus
  message?: string
}

export type DriveSyncResponse = {
  sent: number
  replaced: number
  skipped: number
  failed: number
  results: DriveSyncBookResult[]
}

export type DriveSyncTally = {
  sent: number
  replaced: number
  skipped: number
  failed: number
  failures: { uuid: UUID; title: string; message?: string }[]
}

export const DRIVE_RESULTS = [
  "connected",
  "denied",
  "failed",
  "invalid-state",
  "no-refresh-token",
] as const

export type DriveResult = (typeof DRIVE_RESULTS)[number]

export function parseDriveResult(value: string | null | undefined) {
  return (DRIVE_RESULTS as readonly string[]).includes(value ?? "")
    ? (value as DriveResult)
    : null
}

export function driveRedirectUri(origin: string) {
  return `${origin.replace(/\/+$/, "")}${DRIVE_CALLBACK_PATH}`
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("Batch size must be a positive integer")
  }
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

export function emptyTally(): DriveSyncTally {
  return { sent: 0, replaced: 0, skipped: 0, failed: 0, failures: [] }
}

export function addBatchToTally(
  tally: DriveSyncTally,
  response: DriveSyncResponse,
): DriveSyncTally {
  return {
    sent: tally.sent + response.sent,
    replaced: tally.replaced + response.replaced,
    skipped: tally.skipped + response.skipped,
    failed: tally.failed + response.failed,
    failures: [
      ...tally.failures,
      ...response.results
        .filter((result) => result.status === "failed")
        .map(({ uuid, title, message }) => ({
          uuid,
          title,
          ...(message && { message }),
        })),
    ],
  }
}

/** Books in a batch the server never answered for count as failed. */
export function addFailedBatchToTally(
  tally: DriveSyncTally,
  books: { uuid: UUID; title: string }[],
  message: string,
): DriveSyncTally {
  return {
    ...tally,
    failed: tally.failed + books.length,
    failures: [
      ...tally.failures,
      ...books.map(({ uuid, title }) => ({ uuid, title, message })),
    ],
  }
}
