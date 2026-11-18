import { useLocalSearchParams, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"

import { Epub } from "@/components/Epub"
import { LoadingView } from "@/components/LoadingView"
import { useAutoplayWhenReady } from "@/hooks/useAutoplayWhenReady"
import { isAutoplayParam } from "@/lib/openOptions"
import { useSpansFold } from "@/lib/pose"
import { useIsFocused } from "@/hooks/useIsFocused"
import { useIsNotBackground } from "@/hooks/useIsNotBackground"
import { setBookPrefs } from "@/lib/bookPrefs"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { useGetBookQuery } from "@/store/localApi"
import { bookshelfSlice } from "@/store/slices/bookshelfSlice"
import { type UUID } from "@/uuid"

export default function BookScreen() {
  const { uuid, format, autoplay } = useLocalSearchParams() as {
    uuid: UUID
    format: "readaloud" | "ebook"
    autoplay?: string
  }

  const dispatch = useAppDispatch()

  const { data: book } = useGetBookQuery({ uuid })
  const locator = book?.position?.locator

  const isFocused = useIsFocused()
  const segments = useSegments()
  const isReaderSheetOpen =
    segments.includes("navigation-menu") ||
    segments.includes("speed-menu") ||
    segments.includes("reading-settings") ||
    segments.includes("footnote")
  const isNotBackground = useIsNotBackground()

  const isAudioLoading = useAppSelector(
    (state) => state.bookshelf.isAudioLoading,
  )
  const showEpub =
    !!book &&
    !!locator &&
    (isFocused || isReaderSheetOpen) &&
    isNotBackground &&
    !isAudioLoading

  // Read-aloud narration starts once, when the reader is up and the audio is
  // loaded. An ebook has no audio, so it never autoplays.
  useAutoplayWhenReady({
    enabled: isAutoplayParam(autoplay) && format === "readaloud",
    uuid,
    format,
    ready: showEpub,
  })

  useEffect(() => {
    setBookPrefs(uuid, { lastFormat: format, closed: false })
    dispatch(bookshelfSlice.actions.bookOpened({ bookUuid: uuid, format }))
  }, [dispatch, format, uuid])

  useEffect(() => {
    dispatch(
      bookshelfSlice.actions.playbackSpeedContextChanged({
        context: format === "readaloud" && showEpub ? "reading" : "listening",
      }),
    )

    return () => {
      dispatch(
        bookshelfSlice.actions.playbackSpeedContextChanged({
          context: "listening",
        }),
      )
    }
  }, [dispatch, format, showEpub])

  const spansFold = useSpansFold()

  return (
    <>
      <StatusBar
        verticalBarBehaviorIOS={spansFold ? "disabled" : "automatic"}
      />
      {!showEpub || !book || !locator ? (
        <LoadingView />
      ) : (
        <Epub key={book.uuid} format={format} book={book} locator={locator} />
      )}
    </>
  )
}
