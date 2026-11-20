import { useLocalSearchParams, useRouter } from "expo-router"
import { useMemo } from "react"
import { ScrollView, View, useWindowDimensions } from "react-native"

import { BookGrid } from "@/components/BookGrid"
import { SwipePile } from "@/components/SwipePile"
import { calculateBookGridLayout } from "@/components/bookGridLayout"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { authorCollectionDetail } from "@/lib/authorCollections"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []

/**
 * An automatic author collection: the author's series as piles, then the
 * books that are in no series.
 */
export default function AuthorCollectionScreen() {
  const { author } = useLocalSearchParams() as { author: string }
  const router = useRouter()
  const dimensions = useWindowDimensions()
  // The same tile width as the book grids, so series piles match them.
  const pileWidth = calculateBookGridLayout(dimensions.width).thumbnailWidth
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
              <SwipePile
                key={pile.uuid}
                books={pile.books}
                count={pile.count}
                width={pileWidth}
                label={`${pile.name}, ${pile.count} ${pile.count === 1 ? "book" : "books"}`}
                onOpen={() =>
                  router.push({
                    pathname: "/series/[uuid]",
                    params: { uuid: pile.uuid },
                  })
                }
              >
                <Text className="text-sm font-semibold" numberOfLines={1}>
                  {pile.name}
                </Text>
                <Text className="text-muted-foreground text-xs">
                  {pile.count} {pile.count === 1 ? "book" : "books"}
                </Text>
              </SwipePile>
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
