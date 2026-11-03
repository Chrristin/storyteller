import { useRouter } from "expo-router"
import { useCallback } from "react"

import { type BookWithRelations } from "@/database/books"
import { type BookFormat, getBookPrefs, setBookPrefs } from "@/lib/bookPrefs"

/** Formats that can be opened right now, in the order they are offered. */
export function getOpenableFormats(book: BookWithRelations): BookFormat[] {
  const formats: BookFormat[] = []
  if (book.readaloud?.downloadStatus === "DOWNLOADED") formats.push("readaloud")
  if (book.ebook?.downloadStatus === "DOWNLOADED") formats.push("ebook")
  if (book.audiobook?.downloadStatus === "DOWNLOADED") formats.push("audiobook")
  return formats
}

/**
 * Which format a tap on the book should open: the one used last if it is still
 * on the device, otherwise read-aloud, ebook, audiobook in that order.
 */
export function pickFormat(book: BookWithRelations): BookFormat | null {
  const openable = getOpenableFormats(book)
  const last = getBookPrefs(book.uuid).lastFormat
  if (last && openable.includes(last)) return last
  return openable[0] ?? null
}

export function isStarted(book: BookWithRelations) {
  return book.status?.name === "Reading" && !!book.position
}

export function useOpenBook() {
  const router = useRouter()

  const openFormat = useCallback(
    (book: BookWithRelations, format: BookFormat) => {
      setBookPrefs(book.uuid, { lastFormat: format, closed: false })
      router.push({
        pathname: format === "audiobook" ? "/listen/[uuid]" : "/read/[uuid]",
        params: { uuid: book.uuid, format },
      })
    },
    [router],
  )

  const openDetails = useCallback(
    (book: BookWithRelations) => {
      router.push({ pathname: "/book/[uuid]", params: { uuid: book.uuid } })
    },
    [router],
  )

  /**
   * A book you are partway through, and have not closed, resumes where you left
   * off. Anything else opens its page.
   */
  const openBook = useCallback(
    (book: BookWithRelations) => {
      const format = pickFormat(book)
      if (format && isStarted(book) && !getBookPrefs(book.uuid).closed) {
        openFormat(book, format)
        return
      }
      openDetails(book)
    },
    [openDetails, openFormat],
  )

  return { openBook, openFormat, openDetails }
}
