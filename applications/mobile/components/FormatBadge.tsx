import { BookOpen, Headphones } from "lucide-react-native"
import { View } from "react-native"

import { type BookWithRelations } from "@/database/books"

import { Icon } from "./ui/icon"
import { ReadaloudIcon } from "./ui/icon-readaloud"

/** What a book offers, from the server's point of view. */
export function getFormatKinds(book: BookWithRelations) {
  const hasText = !!book.ebook || !!book.readaloud
  const hasAudio = !!book.audiobook || !!book.readaloud
  return { hasText, hasAudio }
}

/**
 * A dark pill on the cover's bottom-left corner with a book icon, a
 * headphones icon, or both.
 */
export function FormatBadge({ book }: { book: BookWithRelations }) {
  const { hasText, hasAudio } = getFormatKinds(book)
  if (!hasText && !hasAudio) return null

  // An aligned or downloaded read-aloud keeps its own icon, as in the original,
  // so it can be told apart from a separate ebook and audiobook.
  const readaloud =
    book.readaloud?.status === "ALIGNED" ||
    book.readaloud?.downloadStatus === "DOWNLOADED"

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
      {readaloud ? (
        <Icon as={ReadaloudIcon} className="text-white" size={12} />
      ) : (
        <>
          {hasText && <Icon as={BookOpen} className="text-white" size={12} />}
          {hasAudio && (
            <Icon as={Headphones} className="text-white" size={12} />
          )}
        </>
      )}
    </View>
  )
}
