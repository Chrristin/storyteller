import { safeFilename } from "@/assets/bookArchive"
import { withHasPermission } from "@/auth/auth"
import { getBooks } from "@/database/books"
import { recordKindleSends } from "@/database/kindleSends"
import { getSettings } from "@/database/settings"
import { resolveUserPreferences } from "@/database/userPreferencesTypes"
import { getUserSettings } from "@/database/userSettings"
import {
  KINDLE_MAX_BOOKS,
  KINDLE_TOO_LARGE_MESSAGE,
  type KindleSendResponse,
  type KindleSendResult,
  defaultKindleAddress,
  kindleBooks,
  planKindleEmails,
} from "@/kindle"
import { logger } from "@/logging"
import { sendMail } from "@/mail"
import { type UUID } from "@/uuid"

/**
 * @summary Email ebooks to the current user's Kindle address
 * @desc Takes at most 25 books. Books without an ebook are skipped. The books
 *       are split into as many emails as needed, each with at most 25 books and
 *       about 25mb of attachments, sent one after another. A failed email marks
 *       only its books as failed. Can only send to yourself.
 */
export const POST = withHasPermission("bookDownload")(async (request) => {
  const { books: uuids, to } = (await request.json()) as {
    books: UUID[]
    to?: string[]
  }

  const [{ smtpHost, smtpFrom, libraryName }, rawSettings] = await Promise.all([
    getSettings(),
    getUserSettings(request.auth.user.id),
  ])

  if (!smtpHost) {
    return Response.json(
      { code: "smtp-not-configured", message: "Email is not set up" },
      { status: 503 },
    )
  }

  const { kindleAddresses } = resolveUserPreferences(rawSettings)
  const allowedEmails = new Set(kindleAddresses.map((address) => address.email))
  const defaultAddress = defaultKindleAddress(kindleAddresses)

  const recipients =
    to && to.length > 0
      ? to.filter((email) => allowedEmails.has(email))
      : defaultAddress
        ? [defaultAddress.email]
        : []

  if (recipients.length === 0) {
    return Response.json(
      {
        code: "no-kindle-address",
        message: "No Kindle address saved",
        sender: smtpFrom,
      },
      { status: 409 },
    )
  }

  // archived books are never sent (they show up as skipped)
  const books = await getBooks(uuids, request.auth.user.id, {
    archived: "exclude",
  })

  if (kindleBooks(books).length === 0) {
    return Response.json(
      { code: "no-ebook", message: "Cannot send to Kindle: no-ebook" },
      { status: 422 },
    )
  }

  const sendable = kindleBooks(books)
  if (sendable.length > KINDLE_MAX_BOOKS) {
    return Response.json(
      { code: "too-many", message: "Cannot send to Kindle: too-many" },
      { status: 422 },
    )
  }

  const sendableIds = new Set(sendable.map((book) => book.uuid))
  const resultByUuid = new Map<UUID, KindleSendResult>()
  for (const uuid of uuids) {
    if (!sendableIds.has(uuid))
      resultByUuid.set(uuid, { uuid, status: "skipped" })
  }

  const { emails, oversized } = planKindleEmails(
    sendable.map((book) => ({ book, bytes: book.ebook?.fileSize ?? 0 })),
  )
  for (const { book } of oversized) {
    resultByUuid.set(book.uuid, {
      uuid: book.uuid,
      status: "failed",
      message: KINDLE_TOO_LARGE_MESSAGE,
    })
  }

  let sentEmails = 0
  for (const email of emails) {
    const group = email.map(({ book }) => book)
    const [onlyBook] = group
    try {
      await sendMail({
        to: recipients,
        subject:
          group.length === 1 && onlyBook
            ? onlyBook.title
            : `${group.length} books from ${libraryName || "Storyteller"}`,
        text: group.map((book) => book.title).join("\n"),
        attachments: group.map((book) => ({
          filename: `${safeFilename(book.title) || book.uuid}.epub`,
          path: book.ebook?.filepath ?? "",
          contentType: "application/epub+zip",
        })),
      })
    } catch (error) {
      logger.error({ msg: "Failed to send to Kindle", err: error })
      const message = error instanceof Error ? error.message : String(error)
      for (const book of group) {
        resultByUuid.set(book.uuid, {
          uuid: book.uuid,
          status: "failed",
          message,
        })
      }
      continue
    }

    sentEmails += 1
    for (const book of group) {
      resultByUuid.set(book.uuid, { uuid: book.uuid, status: "sent" })
    }

    // Remembering is best effort: the email is already out, so a failure here
    // must not turn the send into an error.
    try {
      await recordKindleSends(
        request.auth.user.id,
        group.map((book) => book.uuid),
        recipients[0] ?? null,
      )
    } catch (error) {
      logger.error({ msg: "Failed to record Kindle send", err: error })
    }
  }

  const results = [...new Set(uuids)].flatMap(
    (uuid) => resultByUuid.get(uuid) ?? [],
  )
  const response: KindleSendResponse = {
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    emails: sentEmails,
    results,
  }
  return Response.json(response)
})
