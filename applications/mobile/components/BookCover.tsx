import { View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { cn } from "@/lib/utils"

import { AudiobookCover } from "./AudiobookCover"
import { EbookCover } from "./EbookCover"

/**
 * A tall cover tile. Books with an ebook cover fill it; audio-only books keep
 * their square cover, centred on the tile, so the shape never has to be guessed.
 */
export function BookCover({
  book,
  width,
  height,
  className,
}: {
  book: BookWithRelations
  width: number
  height: number
  className?: string
}) {
  const hasTextCover = !!book.ebook || !!book.readaloud

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
    </View>
  )
}
