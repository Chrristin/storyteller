import { downloadableAsset } from "@/bookDownloads"
import { type BookWithRelations } from "@/database/books"
import { type KindleAddress } from "@/database/userPreferencesTypes"

export const KINDLE_MAX_BOOKS = 25
export const KINDLE_MAX_BYTES = 25_000_000

export type KindleRefusal = "no-ebook" | "too-many" | "too-large"

export function defaultKindleAddress(
  addresses: KindleAddress[],
): KindleAddress | undefined {
  return addresses.find((address) => address.default) ?? addresses[0]
}

export function kindleBooks<T extends Pick<BookWithRelations, "ebook">>(
  books: T[],
) {
  return books.filter((book) => downloadableAsset(book, "ebook"))
}

export function kindleRefusal(
  books: Pick<BookWithRelations, "ebook">[],
): KindleRefusal | null {
  const sendable = kindleBooks(books)

  if (sendable.length === 0) {
    return "no-ebook"
  }

  if (sendable.length > KINDLE_MAX_BOOKS) {
    return "too-many"
  }

  const bytes = sendable.reduce(
    (total, book) => total + (book.ebook?.fileSize ?? 0),
    0,
  )
  if (bytes > KINDLE_MAX_BYTES) {
    return "too-large"
  }

  return null
}

export const KINDLE_TOO_LARGE_MESSAGE =
  "This ebook is too large to email (limit about 25 MB)"

export type KindlePlan<T> = {
  /** Groups of books to send as one email each, in the given order. */
  emails: T[][]
  /** Books that alone exceed the size limit and cannot be emailed. */
  oversized: T[]
}

/**
 * Splits books into emails of at most maxBooks books and maxBytes of
 * attachments, greedily in the given order. A book that alone exceeds
 * maxBytes goes to `oversized` instead of an email.
 */
export function planKindleEmails<T extends { bytes: number }>(
  books: readonly T[],
  maxBooks = KINDLE_MAX_BOOKS,
  maxBytes = KINDLE_MAX_BYTES,
): KindlePlan<T> {
  const emails: T[][] = []
  const oversized: T[] = []
  let current: T[] = []
  let currentBytes = 0

  for (const book of books) {
    if (book.bytes > maxBytes) {
      oversized.push(book)
      continue
    }
    if (
      current.length > 0 &&
      (current.length >= maxBooks || currentBytes + book.bytes > maxBytes)
    ) {
      emails.push(current)
      current = []
      currentBytes = 0
    }
    current.push(book)
    currentBytes += book.bytes
  }
  if (current.length > 0) emails.push(current)

  return { emails, oversized }
}

export type KindleSendStatusResult = "sent" | "skipped" | "failed"

export type KindleSendResult = {
  uuid: string
  status: KindleSendStatusResult
  message?: string
}

export type KindleSendResponse = {
  sent: number
  skipped: number
  emails: number
  results: KindleSendResult[]
}

/** Whether the book details page shows the Send to Kindle button. */
export function showKindleButton(
  book: Pick<BookWithRelations, "ebook">,
  kindleAvailable: boolean,
) {
  return kindleAvailable && !!downloadableAsset(book, "ebook")
}

/** Books this user sent to a Kindle, by book id. Never-sent books are absent. */
export type KindleSentBooks = Record<
  string,
  { sentAt: string; address: string | null }
>
