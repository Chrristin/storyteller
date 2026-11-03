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
  /** Show a thin progress line under books that are in progress. */
  showProgress?: boolean
}

/** Every cover in a row is the same size, with 24px between books. */
const COVER_WIDTH = 92

export function Shelf({ label, href, books, showProgress = false }: Props) {
  const router = useRouter()

  if (!books.length) return null

  return (
    <Stack className="gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text variant="h3" className="text-base">
          {label}
        </Text>

        {href && (
          <TouchableOpacity
            accessibilityLabel={`View all ${label} books`}
            accessibilityRole="button"
            onPress={() => router.push(href)}
          >
            <Text className="text-primary text-xs font-semibold">
              All ({books.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        data={books.slice(0, 25)}
        contentContainerClassName="gap-6 pr-5"
        showsHorizontalScrollIndicator={false}
        renderItem={({ item: book }) => (
          <BookThumbnail
            book={book}
            showProgress={showProgress}
            width={COVER_WIDTH}
          />
        )}
      />
    </Stack>
  )
}
