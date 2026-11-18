import { useLocalSearchParams, useRouter } from "expo-router"
import { useMemo } from "react"
import { Pressable, ScrollView, View } from "react-native"

import { BookGrid } from "@/components/BookGrid"
import { PileStack } from "@/components/PileStack"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { authorCollectionDetail } from "@/lib/authorCollections"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []
const PILE_WIDTH = 150

/**
 * An automatic author collection: the author's series as piles, then the
 * books that are in no series.
 */
export default function AuthorCollectionScreen() {
  const { author } = useLocalSearchParams() as { author: string }
  const router = useRouter()
  const { data: books = EMPTY_BOOKS } = useListBooksQuery()

  const detail = useMemo(
    () => authorCollectionDetail(books, author),
    [books, author],
  )

  if (!detail) return null

  const header = (
    <View className="px-safe-or-3 gap-3 pb-2">
      <Text className="text-muted-foreground text-sm">
        Author collection. Made automatically.
      </Text>
      {detail.series.length > 0 && (
        <View className="gap-1">
          <Text className="text-[15px] font-semibold">Series</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3"
          >
            {detail.series.map((pile) => (
              <Pressable
                key={pile.uuid}
                accessibilityRole="button"
                accessibilityLabel={`${pile.name}, ${pile.count} ${pile.count === 1 ? "book" : "books"}`}
                className="pt-1 pb-2"
                style={{ width: PILE_WIDTH }}
                onPress={() =>
                  router.push({
                    pathname: "/series/[uuid]",
                    params: { uuid: pile.uuid },
                  })
                }
              >
                <PileStack covers={pile.covers} width={PILE_WIDTH} />
                <Text className="mt-3 text-sm font-semibold" numberOfLines={1}>
                  {pile.name}
                </Text>
                <Text className="text-muted-foreground text-xs">
                  {pile.count} {pile.count === 1 ? "book" : "books"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {detail.looseBooks.length > 0 && (
        <Text className="text-[15px] font-semibold">Other books</Text>
      )}
    </View>
  )

  return (
    <BookGrid
      title={detail.collection.name}
      books={detail.looseBooks}
      header={header}
    />
  )
}
