/**
 * Pure rules for the Archive (the "backroom"). An archived book stays in the
 * library with all its data but is hidden everywhere except the Archive
 * screen. The Archive is common to all users: it lives on the server.
 */

export interface ArchivableBook {
  archivedAt?: string | null
}

export type ArchivedFilter = "exclude" | "only"

/** An older server sends no `archivedAt` at all, which means not archived. */
function archivedAtOf(book: ArchivableBook | null | undefined) {
  return book?.archivedAt ?? null
}

/**
 * `archivedAt` of a book from the server. Read through a loose type so an
 * older server (no field) gives null instead of undefined.
 */
export function serverArchivedAt(serverBook: object): string | null {
  return (serverBook as ArchivableBook).archivedAt ?? null
}

export function isArchived(book: ArchivableBook | null | undefined) {
  return archivedAtOf(book) !== null
}

export interface ArchiveTarget {
  uuid: string
  serverUuid: string | null
  archivedAt?: string | null
}

export interface ArchiveGroups {
  /** Server uuid and the book uuids on it, in first seen order. */
  servers: { serverUuid: string; bookUuids: string[] }[]
  /** Books that only exist on the phone (imported files). */
  local: string[]
}

/** Splits books by the server they live on. Each book is listed once. */
export function groupByServer(books: readonly ArchiveTarget[]): ArchiveGroups {
  const servers = new Map<string, string[]>()
  const local: string[] = []
  const seen = new Set<string>()
  for (const book of books) {
    if (seen.has(book.uuid)) continue
    seen.add(book.uuid)
    if (book.serverUuid === null) {
      local.push(book.uuid)
      continue
    }
    servers.set(book.serverUuid, [
      ...(servers.get(book.serverUuid) ?? []),
      book.uuid,
    ])
  }
  return {
    servers: [...servers].map(([serverUuid, bookUuids]) => ({
      serverUuid,
      bookUuids,
    })),
    local,
  }
}

export const ARCHIVE_URL = "/books/archive"

export function buildArchiveRequest(
  bookUuids: readonly string[],
  archived: boolean,
) {
  return { url: ARCHIVE_URL, body: { books: [...bookUuids], archived } }
}

export const ARCHIVE_TITLE = "Archive"
export const ARCHIVE_EMPTY = "Nothing in the Archive."

/** Menu and button text for one book. */
export function archiveMenuLabel(archived: boolean) {
  return archived ? "Move back to library" : "Move to Archive"
}

/** Selection bar text, with the count when more than one book is selected. */
export function archiveBarLabel(archived: boolean, count: number) {
  if (count <= 1) return archiveMenuLabel(archived)
  return archived ? `Move ${count} back to library` : `Move ${count} to Archive`
}

/** Progress text while the request runs. */
export function archiveBusyLabel(archived: boolean) {
  return archived ? "Moving back..." : "Moving..."
}

export function archiveResultMessage(count: number, archived: boolean) {
  const noun = count === 1 ? "book" : "books"
  return archived
    ? `Moved ${count} ${noun} to the Archive.`
    : `Moved ${count} ${noun} back to the library.`
}

/** Plain English for a failed archive request. */
export function archiveErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown }).status
    if (status === 403) {
      return "You do not have permission to change the library."
    }
    if (status === "FETCH_ERROR") return "Could not reach the server."
    const data = (error as { data?: unknown }).data
    if (typeof data === "object" && data !== null) {
      const message = (data as { message?: unknown }).message
      if (typeof message === "string" && message) return message
    }
  }
  return "Something went wrong. Try again."
}
