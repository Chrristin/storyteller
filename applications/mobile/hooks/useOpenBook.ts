import { useRouter } from "expo-router"
import { useCallback } from "react"

import { type BookWithRelations } from "@/database/books"
import { type BookFormat, getBookPrefs, setBookPrefs } from "@/lib/bookPrefs"
import { autoplayParam } from "@/lib/openOptions"
import { decidePileOpen } from "@/lib/pileOpen"

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
    (
      book: BookWithRelations,
      format: BookFormat,
      options?: { autoplay?: boolean; replace?: boolean },
    ) => {
      setBookPrefs(book.uuid, { lastFormat: format, closed: false })
      // `replace` is for the Read or listen sheet, so the sheet is not left
      // underneath the reader.
      const navigate = options?.replace ? router.replace : router.push
      navigate({
        pathname: format === "audiobook" ? "/listen/[uuid]" : "/read/[uuid]",
        params: {
          uuid: book.uuid,
          format,
          autoplay: autoplayParam(format, options),
        },
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

  /**
   * Opening a book from a pile (rules in lib/pileOpen.ts). Asks Read or Listen
   * when the book has audio and text and no remembered choice, or always with
   * `forceAsk` (long press). The choice is remembered by openFormat.
   */
  const openFromPile = useCallback(
    (book: BookWithRelations, forceAsk = false) => {
      const decision = decidePileOpen(
        getOpenableFormats(book),
        getBookPrefs(book.uuid).lastFormat,
        forceAsk,
      )
      if (decision.kind === "details") openDetails(book)
      else if (decision.kind === "open")
        openFormat(book, decision.format, { autoplay: decision.autoplay })
      else
        router.push({
          pathname: "/read-or-listen",
          params: { uuid: book.uuid },
        })
    },
    [openDetails, openFormat, router],
  )

  return { openBook, openFormat, openDetails, openFromPile }
}
