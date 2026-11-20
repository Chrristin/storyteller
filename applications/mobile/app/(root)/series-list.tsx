import { useRouter } from "expo-router"
import { useMemo } from "react"
import { ScrollView, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { MiniPlayerWidget } from "@/components/MiniPlayerWidget"
import { SwipePile } from "@/components/SwipePile"
import { pileTileWidth } from "@/components/bookGridLayout"
import { ScreenHeader } from "@/components/ScreenHeader"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { buildPiles, keepRealSeries } from "@/lib/piles"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []
const SIDE = 20

export default function SeriesListScreen() {
  const router = useRouter()
  const dimensions = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { data: books = EMPTY_BOOKS } = useListBooksQuery()

  const piles = useMemo(() => keepRealSeries(buildPiles(books)), [books])

  const cellWidth = pileTileWidth(
    dimensions.width - (SIDE + Math.max(insets.left, insets.right)) * 2,
  )

  return (
    <ScreenHeader title="Series">
      <ScrollView
        className="w-full flex-1"
        contentContainerStyle={{
          paddingHorizontal: SIDE + Math.max(insets.left, insets.right),
        }}
      >
        {piles.length === 0 ? (
          <Text className="text-muted-foreground py-6">
            No series with more than one book yet.
          </Text>
        ) : (
          <View className="-mx-1.5 flex-row flex-wrap">
            {piles.map((pile) => (
              <View key={`series-${pile.uuid}`} className="mx-1.5 my-1.5">
                <SwipePile
                  books={pile.books}
                  count={pile.count}
                  width={cellWidth}
                  label={`${pile.name}, ${pile.count} ${pile.count === 1 ? "book" : "books"}${
                    pile.missing > 0 ? `, ${pile.missing} missing` : ""
                  }`}
                  openLabel={pile.name}
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
                  <View className="mt-0.5 flex-row items-center gap-1.5">
                    <Text className="text-muted-foreground text-xs">
                      {pile.count} {pile.count === 1 ? "book" : "books"}
                    </Text>
                    {pile.missing > 0 && (
                      <>
                        <View className="bg-missing size-1.5 rounded-full" />
                        <Text className="text-missing text-xs">
                          {pile.missing} missing
                        </Text>
                      </>
                    )}
                  </View>
                </SwipePile>
              </View>
            ))}
          </View>
        )}
        <View className="h-40 w-full" />
      </ScrollView>
      <MiniPlayerWidget />
    </ScreenHeader>
  )
}
