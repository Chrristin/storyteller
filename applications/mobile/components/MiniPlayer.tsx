import { ChevronsLeft, ChevronsRight } from "lucide-react-native"
import { useMemo, useRef } from "react"
import { TouchableOpacity, View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { cn } from "@/lib/utils"
import { getHrefChapterTitle, positionToPageCount } from "@/links"
import {
  bookDetailPressed,
  miniPlayerSliderChapterPositionChanged,
  nextFragmentPressed,
  playerPositionSeeked,
  playerTotalPositionSeeked,
  previousFragmentPressed,
} from "@/store/actions"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  useGetBookPositionsQuery,
  useGetBookPreferencesQuery,
} from "@/store/localApi"
import {
  formatTimeHuman,
  getBookDuration,
  getBookPosition,
  getCurrentTrackDuration,
  getCurrentTrackIndex,
  getIsPlaying,
  getPlaybackRate,
  getPosition,
  getTrackCount,
} from "@/store/selectors/bookshelfSelectors"

import { AudiobookCover } from "./AudiobookCover"
import { EbookCover } from "./EbookCover"
import { PlayPause } from "./PlayPause"
import { ReadingProgress } from "./ReadingProgress"
import { WaveProgress } from "./WaveProgress"
import { HideableView } from "./ui/HideableView"
import { Button } from "./ui/button"
import { Icon } from "./ui/icon"
import { Text } from "./ui/text"

type Props = {
  book: BookWithRelations
  format: "ebook" | "readaloud"
  hidden: boolean
  floatingToolbar: boolean
}

export function MiniPlayer({ book, format, hidden, floatingToolbar }: Props) {
  const locator = book.position?.locator
  const { data: bookPrefs } = useGetBookPreferencesQuery({ uuid: book.uuid })
  const position = useAppSelector(getPosition)
  const isPlaying = useAppSelector(getIsPlaying)
  const bookPosition = useAppSelector(getBookPosition)
  const bookDuration = useAppSelector(getBookDuration)
  const currentTrackIndex = useAppSelector(getCurrentTrackIndex)
  const trackCount = useAppSelector(getTrackCount)
  const trackDuration = useAppSelector(getCurrentTrackDuration)

  const rate = useAppSelector(getPlaybackRate)

  const trackPositionRef = useRef(position)
  trackPositionRef.current = position

  const dispatch = useAppDispatch()

  const manifest =
    format === "readaloud" ? book.readaloud?.epubManifest : book.ebook?.manifest
  const { data: positions } = useGetBookPositionsQuery({
    bookUuid: book.uuid,
    format,
  })

  const chapterTitle = useMemo(() => {
    if (!manifest?.toc) return null
    if (!locator?.href) return null

    return getHrefChapterTitle(locator.href, manifest.toc)
  }, [manifest?.toc, locator?.href])

  const chapterPositions = useMemo(() => {
    return (
      positions?.filter((position) => position.href === locator?.href) ?? []
    )
  }, [positions, locator?.href])

  const progress = useMemo(() => {
    if (bookPrefs?.detailView?.mode === "audio") {
      if (bookPrefs?.detailView?.scope === "book") {
        return bookPosition
      }
      return position
    }
    if (bookPrefs?.detailView?.scope === "book") {
      const position =
        locator?.locations?.position ??
        positions?.findIndex(
          (position) =>
            (position.locations?.totalProgression ?? 0) >=
            (locator?.locations?.totalProgression ?? 0),
        ) ??
        0

      return position === -1 ? (positions?.length ?? 1) : position + 1
    }
    const chapterPosition =
      chapterPositions.findIndex(
        (position) =>
          (position.locations?.progression ?? 0) >=
          (locator?.locations?.progression ?? 0),
      ) ?? 0

    return chapterPosition === -1
      ? (chapterPositions.length ?? 1)
      : chapterPosition + 1
  }, [
    positions,
    bookPrefs?.detailView?.mode,
    bookPrefs?.detailView?.scope,
    chapterPositions,
    locator?.locations?.position,
    locator?.locations?.progression,
    locator?.locations?.totalProgression,
    bookPosition,
    position,
  ])

  const { title, formattedProgress } = useMemo(() => {
    if (bookPrefs?.detailView?.mode === "audio") {
      if (bookPrefs.detailView.scope === "book") {
        return {
          title: book.title,
          formattedProgress: `${formatTimeHuman(bookDuration - progress, rate)} left`,
        }
      }
      return {
        title: `Track ${currentTrackIndex + 1} of ${trackCount}`,
        formattedProgress: `${formatTimeHuman(trackDuration - progress, rate)} left`,
      }
    }
    if (bookPrefs?.detailView?.scope === "book") {
      const position =
        locator?.locations?.position ??
        (positions?.findIndex(
          (position) =>
            (position.locations?.totalProgression ?? 0) >=
            (locator?.locations?.totalProgression ?? 0),
        ) ?? 0) + 1
      return {
        title: book.title,
        formattedProgress: `pg. ${positionToPageCount(position) || 1} / ${positionToPageCount(positions?.length ?? 0)}`,
      }
    }
    const chapterPosition = chapterPositions.findIndex(
      (position) =>
        (position.locations?.progression ?? 0) >=
        (locator?.locations?.progression ?? 0),
    )

    return {
      title: chapterTitle,
      formattedProgress: `pg. ${positionToPageCount(chapterPosition === -1 ? chapterPositions.length : chapterPosition + 1) || 1} / ${positionToPageCount(chapterPositions.length)}`,
    }
  }, [
    bookPrefs?.detailView?.mode,
    bookPrefs?.detailView?.scope,
    chapterPositions,
    chapterTitle,
    currentTrackIndex,
    trackCount,
    trackDuration,
    progress,
    rate,
    book.title,
    bookDuration,
    locator?.locations?.position,
    locator?.locations?.totalProgression,
    locator?.locations?.progression,
    positions,
  ])

  const progressStart = bookPrefs?.detailView?.mode === "audio" ? 0 : 1

  const progressEnd =
    bookPrefs?.detailView?.mode === "audio"
      ? bookPrefs?.detailView?.scope === "book"
        ? bookDuration
        : trackDuration
      : bookPrefs?.detailView?.scope === "book"
        ? positions?.length
        : chapterPositions.length

  return (
    bookPrefs && (
      <View>
        <HideableView
          hidden={hidden}
          className={cn(
            "ios:pb-[max(calc(env(safe-area-inset-bottom)_-_--spacing(4)),--spacing(2))] android:pb-2 z-3 px-safe-or-3 pt-10",
            {
              "bg-background ios:bottom-0 android:bottom-safe absolute right-0 left-0":
                floatingToolbar,
              "android:mb-safe-or-2": !floatingToolbar,
            },
          )}
        >
          <View className="-mr-3 -ml-1 flex-row items-center gap-0">
            {bookPrefs?.detailView?.mode === "audio" ? (
              <WaveProgress
                accessibilityLabel="Mini player progress"
                height={22}
                paused={!isPlaying}
                start={progressStart}
                stop={progressEnd ?? 0}
                progress={progress}
                onProgressChange={
                  bookPrefs?.detailView?.scope === "book"
                    ? undefined
                    : (value) => {
                        if (bookPrefs?.detailView?.mode === "audio") {
                          if (bookPrefs?.detailView?.scope === "book") {
                            dispatch(
                              playerTotalPositionSeeked({ progress: value }),
                            )
                          } else {
                            dispatch(playerPositionSeeked({ progress: value }))
                          }
                        } else {
                          const nextLocator = chapterPositions[value - 1]
                          if (nextLocator === undefined) return
                          dispatch(
                            miniPlayerSliderChapterPositionChanged({
                              bookUuid: book.uuid,
                              locator: nextLocator,
                              timestamp: Date.now(),
                            }),
                          )
                        }
                      }
                }
              />
            ) : (
              <ReadingProgress
                accessibilityLabel="Mini player progress"
                className="grow"
                start={progressStart}
                stop={progressEnd ?? 0}
                progress={progress}
                onProgressChange={
                  bookPrefs?.detailView?.scope === "book"
                    ? undefined
                    : (value) => {
                        if (bookPrefs?.detailView?.mode === "audio") {
                          if (bookPrefs?.detailView?.scope === "book") {
                            dispatch(
                              playerTotalPositionSeeked({ progress: value }),
                            )
                          } else {
                            dispatch(playerPositionSeeked({ progress: value }))
                          }
                        } else {
                          const nextLocator = chapterPositions[value - 1]
                          if (nextLocator === undefined) return
                          dispatch(
                            miniPlayerSliderChapterPositionChanged({
                              bookUuid: book.uuid,
                              locator: nextLocator,
                              timestamp: Date.now(),
                            }),
                          )
                        }
                      }
                }
              />
            )}
            {format !== "ebook" && (
              <>
                <Button
                  accessibilityLabel="Previous section"
                  variant="ghost"
                  onPress={() => {
                    dispatch(previousFragmentPressed())
                  }}
                >
                  <Icon
                    as={ChevronsLeft}
                    className="text-muted-foreground"
                    size={20}
                    strokeWidth={1.5}
                  />
                </Button>
                <PlayPause automaticRewind={false} buttonSize="default" />
                <Button
                  accessibilityLabel="Next section"
                  variant="ghost"
                  onPress={() => {
                    dispatch(nextFragmentPressed())
                  }}
                >
                  <Icon
                    as={ChevronsRight}
                    className="text-muted-foreground"
                    size={20}
                    strokeWidth={1.5}
                  />
                </Button>
              </>
            )}
          </View>

          <View className="pr-safe-or-6 flex-row items-start gap-3 pt-1">
            <View
              className={
                bookPrefs.detailView?.mode === "audio" ? "w-[88px]" : "w-[76px]"
              }
            />
            <TouchableOpacity
              accessibilityLabel={`Open details for ${title}`}
              accessibilityRole="button"
              className="min-h-14 flex-1 flex-col items-stretch justify-center"
              onPress={() => {
                dispatch(bookDetailPressed({ bookUuid: book.uuid, format }))
              }}
            >
              <Text
                maxFontSizeMultiplier={1.25}
                numberOfLines={2}
                className="text-base font-semibold"
              >
                {book.title}
              </Text>
              <Text
                maxFontSizeMultiplier={1.25}
                numberOfLines={1}
                className="text-muted-foreground text-sm"
              >
                {formattedProgress} ·{" "}
                {Math.round((locator?.locations?.totalProgression ?? 0) * 100)}%
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            accessibilityLabel={`Open details for ${title}`}
            accessibilityRole="button"
            className="border-border bg-secondary absolute bottom-2 left-4 overflow-hidden rounded-lg border"
            onPress={() => {
              dispatch(bookDetailPressed({ bookUuid: book.uuid, format }))
            }}
            style={
              bookPrefs.detailView?.mode === "audio"
                ? { height: 88, width: 88 }
                : { height: 120, width: 80 }
            }
          >
            {bookPrefs.detailView?.mode === "audio" ? (
              <AudiobookCover book={book} />
            ) : (
              <EbookCover book={book} />
            )}
          </TouchableOpacity>
        </HideableView>
      </View>
    )
  )
}
