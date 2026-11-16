import { memo } from "react"
import { Text, View } from "react-native"
import Svg, { Path } from "react-native-svg"

import { type BookWithRelations } from "@/database/books"
import { useDownloadedFormats } from "@/hooks/useDownloadedFormats"
import {
  OVERLAY_AUTHOR_LINES,
  OVERLAY_FONT_SIZES,
  OVERLAY_TITLE_LINES,
  shouldShowTitleOverlay,
} from "@/lib/coverTitleOverlay"
import { useLibraryLook } from "@/lib/libraryLook"
import { cn } from "@/lib/utils"
import {
  type Rgb,
  WAVE_HEIGHT,
  WAVE_WIDTH,
  fallbackColor,
  hexToRgb,
  wavePalette,
  wavePathsForBook,
} from "@/lib/waves"

import { AudiobookCover } from "./AudiobookCover"
import { EbookCover } from "./EbookCover"
import { FormatBadge } from "./FormatBadge"

/**
 * A book cover in the same tall slot as every other cover in a list.
 *
 * Books with an ebook cover fill the slot. An audiobook cover is square and
 * stays square and whole at the top of the slot, with four layered waves in the
 * cover's main colour filling the space below (or a plain card background with
 * the wave fill setting off). With `keepSlot` off, an audiobook
 * cover is just the square.
 *
 * On a wave cover the title and author are written in white inside the waves,
 * unless the "Titles under covers" setting is on or `showTitleOverlay` is off
 * (the currently reading strip and the book page hero).
 *
 * A thin accent line along the bottom edge shows progress, and a small pill in
 * the top-left corner marks anything with audio.
 */
export function BookCover({
  book,
  width,
  height,
  badge = true,
  keepSlot = true,
  progressLine = true,
  showTitleOverlay = true,
  className,
}: {
  book: BookWithRelations
  width: number
  height: number
  badge?: boolean
  keepSlot?: boolean
  progressLine?: boolean
  showTitleOverlay?: boolean
  className?: string
}) {
  const [{ waveFill, showTitles }] = useLibraryLook()
  const hasTextCover = !!book.ebook || !!book.readaloud
  const onDevice = useDownloadedFormats(book).length > 0
  const progression = book.position?.locator.locations?.totalProgression
  const inProgress =
    progressLine &&
    typeof progression === "number" &&
    progression > 0 &&
    progression < 1

  const overlays = (
    <>
      {badge && <FormatBadge book={book} />}
      {badge && onDevice && (
        <View
          accessibilityLabel="On this device"
          className="bg-primary border-background absolute top-1.5 right-1.5 size-2.5 rounded-full border-2"
        />
      )}
      {inProgress && (
        <View className="absolute right-0 bottom-0 left-0 h-[3px] bg-black/60">
          <View
            className="bg-primary h-full"
            style={{ width: `${Math.round(progression * 100)}%` }}
          />
        </View>
      )}
    </>
  )

  const frame = cn(
    "bg-secondary border-border overflow-hidden rounded-md border",
    className,
  )

  if (hasTextCover) {
    return (
      <View className={frame} style={{ height, width }}>
        <EbookCover book={book} />
        {overlays}
      </View>
    )
  }

  if (!keepSlot) {
    return (
      <View className={frame} style={{ height: width, width }}>
        <AudiobookCover book={book} contentFit="cover" />
        {overlays}
      </View>
    )
  }

  const main =
    (book.audioCoverColor && hexToRgb(book.audioCoverColor)) ||
    fallbackColor(book.uuid)
  return (
    <View
      className={frame}
      style={{ height, width, backgroundColor: wavePalette(main).background }}
    >
      <View
        style={{ height: width, left: 0, position: "absolute", top: 0, width }}
      >
        <AudiobookCover book={book} contentFit="cover" />
      </View>
      {waveFill && (
        <WaveFill
          uuid={book.uuid}
          main={main}
          top={width}
          width={width}
          height={height - width}
        />
      )}
      {shouldShowTitleOverlay({ showTitleOverlay, waveFill, showTitles }) && (
        <TitleOverlay
          title={book.title}
          author={book.authors[0]?.name}
          width={width}
          height={height - width}
        />
      )}
      {overlays}
    </View>
  )
}

const WaveFill = memo(function WaveFill({
  uuid,
  main,
  top,
  width,
  height,
}: {
  uuid: string
  main: Rgb
  top: number
  width: number
  height: number
}) {
  if (height <= 0) return null
  const paths = wavePathsForBook(uuid)
  const { layers } = wavePalette(main)
  return (
    <Svg
      pointerEvents="none"
      style={{ left: 0, position: "absolute", top }}
      width={width}
      height={height}
      viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`}
      preserveAspectRatio="none"
    >
      {paths.map((d, i) => (
        <Path key={i} d={d} fill={layers[i]!} />
      ))}
    </Svg>
  )
})

/** Fade steps from clear to about 55% black, drawn as stacked layers. */
const FADE_STEPS = [0.14, 0.14, 0.14, 0.13]

function TitleOverlay({
  title,
  author,
  width,
  height,
}: {
  title: string
  author?: string | undefined
  width: number
  height: number
}) {
  if (height <= 0) return null
  const sizes = OVERLAY_FONT_SIZES
  return (
    <View
      pointerEvents="none"
      style={{ bottom: 0, left: 0, position: "absolute", width }}
    >
      {/* Stacked layers add up to a soft fade, as expo-linear-gradient is not used here. */}
      <View
        style={{
          bottom: 0,
          left: 0,
          position: "absolute",
          right: 0,
          top: -Math.min(16, height * 0.3),
        }}
      >
        {FADE_STEPS.map((alpha, i) => (
          <View
            key={i}
            style={{
              backgroundColor: `rgba(0,0,0,${alpha})`,
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: `${(i * 100) / FADE_STEPS.length}%`,
            }}
          />
        ))}
      </View>
      <View
        style={{
          maxHeight: height,
          paddingBottom: 8,
          paddingLeft: 8,
          paddingRight: 10,
        }}
      >
        {!!author && (
          <Text
            ellipsizeMode="tail"
            numberOfLines={OVERLAY_AUTHOR_LINES}
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: sizes.author,
              lineHeight: sizes.author + 3,
            }}
          >
            {author}
          </Text>
        )}
        <Text
          ellipsizeMode="tail"
          numberOfLines={OVERLAY_TITLE_LINES}
          style={{
            color: "#ffffff",
            fontSize: sizes.title,
            fontWeight: "600",
            lineHeight: sizes.title + 3,
          }}
        >
          {title}
        </Text>
      </View>
    </View>
  )
}
