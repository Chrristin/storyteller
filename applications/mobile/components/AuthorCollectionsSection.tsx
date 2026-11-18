import { useRouter } from "expo-router"
import { View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { type BookWithRelations } from "@/database/books"
import { type AuthorCollection } from "@/lib/authorCollections"

import { AuthorCollectionTile } from "./AuthorCollectionTile"
import { Button } from "./ui/button"
import { Text } from "./ui/text"

const GAP = 12
/** How many author collections Home shows before the "All" button. */
export const HOME_AUTHOR_LIMIT = 6

/**
 * Home: the automatic author collections, two to a row. Renders nothing when
 * no author has two or more books.
 */
export function AuthorCollectionsSection({
  collections,
}: {
  collections: readonly AuthorCollection<BookWithRelations>[]
}) {
  const router = useRouter()
  const dimensions = useWindowDimensions()
  const insets = useSafeAreaInsets()

  if (collections.length === 0) return null

  // The Home scroll view pads 20px each side (or the safe area, if larger).
  const side = Math.max(20, insets.left, insets.right)
  const cellWidth = Math.floor((dimensions.width - side * 2 - GAP) / 2)
  const shown = collections.slice(0, HOME_AUTHOR_LIMIT)

  return (
    <View className="gap-2">
      <Text className="text-[15px] font-semibold">Authors</Text>
      <View className="flex-row flex-wrap" style={{ columnGap: GAP }}>
        {shown.map((collection) => (
          <AuthorCollectionTile
            key={collection.key}
            collection={collection}
            width={cellWidth}
          />
        ))}
      </View>
      {collections.length > shown.length && (
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-full"
          accessibilityLabel="All author collections"
          onPress={() => router.push("/author-collections")}
        >
          <Text>All {collections.length}</Text>
        </Button>
      )}
    </View>
  )
}
