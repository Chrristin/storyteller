import { BookOpen, Headphones } from "lucide-react-native"
import { Pressable, View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { pickFormat, useOpenBook } from "@/hooks/useOpenBook"

import { BookCover } from "./BookCover"
import { Icon } from "./ui/icon"
import { Text } from "./ui/text"

/**
 * The book you are reading right now. Tapping anywhere on the card resumes it
 * in the format you used last; the icon in the corner shows which one.
 */
export function ContinueCard({ book }: { book: BookWithRelations }) {
  const { openFormat, openDetails } = useOpenBook()
  const format = pickFormat(book)
  const progression = book.position?.locator.locations?.totalProgression
  const percent =
    typeof progression === "number" ? Math.round(progression * 100) : null

  return (
    <Pressable
      accessibilityLabel={`Continue ${book.title}`}
      accessibilityRole="button"
      className="bg-card border-border active:bg-secondary flex-row gap-4 rounded-2xl border p-4"
      onPress={() => {
        if (format) openFormat(book, format)
        else openDetails(book)
      }}
    >
      <BookCover book={book} badge={false} height={138} width={92} />
      <View className="min-w-0 flex-1 pr-6">
        <Text className="text-primary text-[10px] font-bold tracking-widest uppercase">
          Continue
        </Text>
        <Text className="mt-1 text-base leading-5 font-bold" numberOfLines={3}>
          {book.title}
        </Text>
        <Text
          className="text-muted-foreground mt-0.5 text-xs"
          numberOfLines={1}
        >
          {book.authors[0]?.name}
        </Text>
        <View className="flex-1" />
        {percent !== null && (
          <>
            <View className="bg-secondary h-1 overflow-hidden rounded-full">
              <View
                className="bg-primary h-full"
                style={{ width: `${percent}%` }}
              />
            </View>
            <Text className="text-muted-foreground mt-1.5 text-xs">
              {percent}%
            </Text>
          </>
        )}
      </View>
      {format && (
        <View className="absolute top-4 right-4">
          <Icon
            as={format === "audiobook" ? Headphones : BookOpen}
            className="text-muted-foreground"
            size={18}
          />
        </View>
      )}
    </Pressable>
  )
}
