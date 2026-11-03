import { BookOpen, Headphones } from "lucide-react-native"
import { View } from "react-native"

import { type BookWithRelations } from "@/database/books"

import { Icon } from "./ui/icon"
import { Text } from "./ui/text"

/** What a book offers, from the server's point of view. */
export function getFormatKinds(book: BookWithRelations) {
  const hasText = !!book.ebook || !!book.readaloud
  const hasAudio = !!book.audiobook || !!book.readaloud
  return { hasText, hasAudio }
}

/**
 * A small pill on the cover: a book for text, headphones for audio, both
 * for a book that has both (including read-aloud).
 */
export function FormatBadge({ book }: { book: BookWithRelations }) {
  const { hasText, hasAudio } = getFormatKinds(book)
  if (!hasText && !hasAudio) return null

  const label = hasText && hasAudio ? "Both" : hasText ? "Book" : "Audio"

  return (
    <View
      accessibilityLabel={
        hasText && hasAudio
          ? "Book and audiobook"
          : hasText
            ? "Book"
            : "Audiobook"
      }
      className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1 rounded-full bg-black/80 px-2 py-1"
    >
      {hasText && <Icon as={BookOpen} className="text-white" size={11} />}
      {hasAudio && <Icon as={Headphones} className="text-white" size={11} />}
      <Text className="text-[10px] font-semibold text-white">{label}</Text>
    </View>
  )
}
