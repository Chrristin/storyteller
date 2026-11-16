import { View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { useDownloadedFormats } from "@/hooks/useDownloadedFormats"
import { useLibraryLook } from "@/lib/libraryLook"
import { cn } from "@/lib/utils"

import { AudiobookCover } from "./AudiobookCover"
import { EbookCover } from "./EbookCover"
import { FormatBadge } from "./FormatBadge"

/**
 * A book cover in the same tall slot as every other cover in a list.
 *
 * Books with an ebook cover fill the slot. An audiobook cover is square and
 * stays square and whole, centred in the slot, with a blurred copy of the same
 * cover filling the space above and below. With `keepSlot` off, an audiobook
 * cover is just the square.
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
  className,
}: {
  book: BookWithRelations
  width: number
  height: number
  badge?: boolean
  keepSlot?: boolean
  progressLine?: boolean
  className?: string
}) {
  const [{ blurFill }] = useLibraryLook()
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

  return (
    <View className={frame} style={{ height, width }}>
      {/* A larger, blurred copy fills the slot so there are no hard bands.
          With the blur setting off, the space is a plain dark fill. */}
      {blurFill ? (
        <>
          <View
            pointerEvents="none"
            style={{
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
              transform: [{ scale: 1.4 }],
            }}
          >
            <AudiobookCover book={book} blurRadius={20} contentFit="cover" />
          </View>
          <View
            pointerEvents="none"
            style={{
              backgroundColor: "rgba(0,0,0,0.25)",
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          />
        </>
      ) : (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: "#0b0b0c",
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />
      )}
      <View
        style={{
          height: width,
          left: 0,
          position: "absolute",
          top: Math.round((height - width) / 2),
          width,
        }}
      >
        <AudiobookCover book={book} contentFit="cover" />
      </View>
      {overlays}
    </View>
  )
}
