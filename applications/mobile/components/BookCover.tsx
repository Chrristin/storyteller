import { View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { useDownloadedFormats } from "@/hooks/useDownloadedFormats"
import { cn } from "@/lib/utils"

import { AudiobookCover } from "./AudiobookCover"
import { EbookCover } from "./EbookCover"
import { FormatBadge } from "./FormatBadge"

/**
 * A tall cover tile. Books with an ebook cover fill it; audio-only books keep
 * their square cover, centred on the tile, so the shape never has to be guessed.
 */
export function BookCover({
  book,
  width,
  height,
  badge = true,
  className,
}: {
  book: BookWithRelations
  width: number
  height: number
  badge?: boolean
  className?: string
}) {
  const hasTextCover = !!book.ebook || !!book.readaloud
  const onDevice = useDownloadedFormats(book).length > 0

  return (
    <View
      className={cn(
        "bg-secondary border-border justify-center overflow-hidden rounded-md border",
        className,
      )}
      style={{ height, width }}
    >
      {hasTextCover ? (
        <EbookCover book={book} />
      ) : (
        <AudiobookCover book={book} contentFit="contain" />
      )}
      {badge && <FormatBadge book={book} />}
      {badge && onDevice && (
        <View
          accessibilityLabel="On this device"
          className="bg-primary border-background absolute top-1.5 right-1.5 size-2.5 rounded-full border-2"
        />
      )}
    </View>
  )
}
