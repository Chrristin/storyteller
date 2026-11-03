import { type HrefObject, useRouter } from "expo-router"
import { TouchableOpacity, View } from "react-native"
import { FlatList } from "react-native-gesture-handler"

import { type BookWithRelations } from "@/database/books"

import { BookThumbnail } from "./BookThumbnail"
import { Stack } from "./ui/Stack"
import { Text } from "./ui/text"

interface Props {
  label: string
  href?: string | HrefObject | undefined
  books: BookWithRelations[]
  /** Make the first book larger, for a "continue" row. */
  featuredFirst?: boolean
  showProgress?: boolean
  cardWidth?: number
  /** The main shelf gets a bigger heading and more room than the rest. */
  primary?: boolean
}

const FEATURED_WIDTH = 190

export function Shelf({
  label,
  href,
  books,
  featuredFirst = false,
  showProgress = false,
  cardWidth = 116,
  primary = false,
}: Props) {
  const router = useRouter()

  if (!books.length) return null

  return (
    <Stack className={primary ? "gap-4" : "gap-3"}>
      <View className="flex-row items-baseline justify-between pr-3">
        <Text
          variant={primary ? "h2" : "h3"}
          className={primary ? "text-2xl" : "text-lg"}
        >
          {label}
        </Text>

        {href && (
          <TouchableOpacity
            accessibilityLabel={`View all ${label} books`}
            accessibilityRole="button"
            onPress={() => router.push(href)}
            className="flex-row items-center"
          >
            <Text className="text-primary text-sm font-medium">
              View all ({books.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        data={books.slice(0, 25)}
        contentContainerClassName="gap-4 pr-6"
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        renderItem={({ item: book, index }) => (
          <BookThumbnail
            book={book}
            showProgress={showProgress}
            width={featuredFirst && index === 0 ? FEATURED_WIDTH : cardWidth}
          />
        )}
      />
    </Stack>
  )
}
