import { useMemo } from "react"
import { ScrollView, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AuthorCollectionTile } from "@/components/AuthorCollectionTile"
import { pileTileWidth } from "@/components/bookGridLayout"
import { MiniPlayerWidget } from "@/components/MiniPlayerWidget"
import { ScreenHeader } from "@/components/ScreenHeader"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { buildAuthorCollections } from "@/lib/authorCollections"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []
const SIDE = 20

/** Every automatic author collection (authors with two or more books). */
export default function AuthorCollectionsScreen() {
  const dimensions = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { data: books = EMPTY_BOOKS } = useListBooksQuery()
  const collections = useMemo(() => buildAuthorCollections(books), [books])

  const cellWidth = pileTileWidth(
    dimensions.width - (SIDE + Math.max(insets.left, insets.right)) * 2,
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
          <View className="-mx-1.5 flex-row flex-wrap">
            {collections.map((collection) => (
              <View key={collection.key} className="mx-1.5 my-1.5">
                <AuthorCollectionTile
                  collection={collection}
                  width={cellWidth}
                />
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
