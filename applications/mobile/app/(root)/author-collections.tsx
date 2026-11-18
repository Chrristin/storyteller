import { useMemo } from "react"
import { ScrollView, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AuthorCollectionTile } from "@/components/AuthorCollectionTile"
import { MiniPlayerWidget } from "@/components/MiniPlayerWidget"
import { ScreenHeader } from "@/components/ScreenHeader"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { buildAuthorCollections } from "@/lib/authorCollections"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []
const GAP = 12
const SIDE = 20

/** Every automatic author collection (authors with two or more books). */
export default function AuthorCollectionsScreen() {
  const dimensions = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { data: books = EMPTY_BOOKS } = useListBooksQuery()
  const collections = useMemo(() => buildAuthorCollections(books), [books])

  const cellWidth = Math.floor(
    (dimensions.width - insets.left - insets.right - SIDE * 2 - GAP) / 2,
  )

  return (
    <ScreenHeader title="Authors">
      <ScrollView
        className="w-full flex-1"
        contentContainerStyle={{
          paddingHorizontal: SIDE + Math.max(insets.left, insets.right),
        }}
      >
        {collections.length === 0 ? (
          <Text className="text-muted-foreground py-6">
            No author has two or more books yet.
          </Text>
        ) : (
          <View className="flex-row flex-wrap" style={{ columnGap: GAP }}>
            {collections.map((collection) => (
              <AuthorCollectionTile
                key={collection.key}
                collection={collection}
                width={cellWidth}
              />
            ))}
          </View>
        )}
        <View className="h-40 w-full" />
      </ScrollView>
      <MiniPlayerWidget />
    </ScreenHeader>
  )
}
