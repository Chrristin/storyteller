import { View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { useDownloadedFormats } from "@/hooks/useDownloadedFormats"
import { cn } from "@/lib/utils"

import { AudiobookCover } from "./AudiobookCover"
import { EbookCover } from "./EbookCover"
import { FormatBadge } from "./FormatBadge"

/**
 * A book cover with its true shape. Books with an ebook cover are a tall tile.
 * Audiobook covers are square and stay square, with nothing painted around them.
 *
 * `keepSlot` (the default) reserves the tall tile's height for a square cover
 * and sits the square on the bottom of it, so titles under a row of mixed
 * covers still line up. Without it, an audiobook cover is just the square.
 */
export function BookCover({
  book,
  width,
  height,
  badge = true,
  keepSlot = true,
  className,
}: {
  book: BookWithRelations
  width: number
  height: number
  badge?: boolean
  keepSlot?: boolean
  className?: string
}) {
  const hasTextCover = !!book.ebook || !!book.readaloud
  const onDevice = useDownloadedFormats(book).length > 0

  const overlays = (
    <>
      {badge && <FormatBadge book={book} />}
      {badge && onDevice && (
        <View
          accessibilityLabel="On this device"
          className="bg-primary border-background absolute top-1.5 right-1.5 size-2.5 rounded-full border-2"
        />
      )}
    </>
  )

  if (hasTextCover) {
    return (
      <View
        className={cn(
          "bg-secondary border-border overflow-hidden rounded-md border",
          className,
        )}
        style={{ height, width }}
      >
        <EbookCover book={book} />
        {overlays}
      </View>
    )
  }

  const square = (
    <View
      className={cn(
        "bg-secondary border-border overflow-hidden rounded-md border",
        className,
      )}
      style={{ height: width, width }}
    >
      <AudiobookCover book={book} contentFit="cover" />
      {overlays}
    </View>
  )

  if (!keepSlot) return square

  return (
    <View style={{ height, justifyContent: "flex-end", width }}>{square}</View>
  )
}
