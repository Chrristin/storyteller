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
 * One small dark pill in the cover's top-left corner. An audiobook gets a
 * headphones icon, a read-aloud gets headphones and a book together, and a
 * plain ebook gets no mark at all.
 */
export function FormatBadge({ book }: { book: BookWithRelations }) {
  const { hasText, hasAudio } = getFormatKinds(book)
  if (!hasAudio) return null

  return (
    <View
      accessibilityLabel={hasText ? "Book and audiobook" : "Audiobook"}
      className="absolute top-1.5 left-1.5 flex-row items-center gap-1 rounded-full bg-black/70 px-1.5 py-1"
    >
      <Icon as={Headphones} className="text-white" size={12} />
      {hasText && <Icon as={BookOpen} className="text-white" size={12} />}
    </View>
  )
}
