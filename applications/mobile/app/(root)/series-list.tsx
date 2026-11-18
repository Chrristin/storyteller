import { useRouter } from "expo-router"
import { useMemo } from "react"
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { MiniPlayerWidget } from "@/components/MiniPlayerWidget"
import { PileStack } from "@/components/PileStack"
import { ScreenHeader } from "@/components/ScreenHeader"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { buildPiles } from "@/lib/piles"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []
const GAP = 12
const SIDE = 20

export default function SeriesListScreen() {
  const router = useRouter()
  const dimensions = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { data: books = EMPTY_BOOKS } = useListBooksQuery()

  const piles = useMemo(() => buildPiles(books, "series"), [books])

  const cellWidth = Math.floor(
    (dimensions.width - insets.left - insets.right - SIDE * 2 - GAP) / 2,
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
            None of your books are in a series yet.
          </Text>
        ) : (
          <View className="flex-row flex-wrap" style={{ columnGap: GAP }}>
            {piles.map((pile) => (
              <Pressable
                key={`${pile.kind}-${pile.uuid}`}
                accessibilityRole="button"
                accessibilityLabel={`${pile.name}, ${pile.count} books${
                  pile.missing > 0 ? `, ${pile.missing} missing` : ""
                }`}
                className="pt-2 pb-4"
                style={{ width: cellWidth }}
                onPress={() =>
                  router.push({
                    pathname: "/series/[uuid]",
                    params: { uuid: pile.uuid },
                  })
                }
              >
                <PileStack covers={pile.covers} width={cellWidth} />
                <Text className="mt-3 text-sm font-semibold" numberOfLines={1}>
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
              </Pressable>
            ))}
          </View>
        )}
        <View className="h-40 w-full" />
      </ScrollView>
      <MiniPlayerWidget />
    </ScreenHeader>
  )
}
