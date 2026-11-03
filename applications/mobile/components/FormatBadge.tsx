import { BookOpen, Headphones } from "lucide-react-native"
import { View } from "react-native"

import { type BookWithRelations } from "@/database/books"

import { Icon } from "./ui/icon"

/** What a book offers, from the server's point of view. */
export function getFormatKinds(book: BookWithRelations) {
  const hasText = !!book.ebook || !!book.readaloud
  const hasAudio = !!book.audiobook || !!book.readaloud
  return { hasText, hasAudio }
}

/**
 * Small icons for what a book offers: a book for text, headphones for audio,
 * both for a book that has both. Shown in the line under the cover, never on
 * top of it.
 */
export function FormatBadge({ book }: { book: BookWithRelations }) {
  const { hasText, hasAudio } = getFormatKinds(book)
  if (!hasText && !hasAudio) return null

  return (
    <View
      accessibilityLabel={
        hasText && hasAudio
          ? "Book and audiobook"
          : hasText
            ? "Book"
            : "Audiobook"
      }
      className="flex-row items-center gap-1"
    >
      {hasText && (
        <Icon
          as={BookOpen}
          className="text-primary"
          size={13}
          strokeWidth={2}
        />
      )}
      {hasAudio && (
        <Icon
          as={Headphones}
          className="text-primary"
          size={13}
          strokeWidth={2}
        />
      )}
    </View>
  )
}
