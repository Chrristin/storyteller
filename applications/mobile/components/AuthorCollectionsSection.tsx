import { View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { type BookWithRelations } from "@/database/books"
import { type AuthorCollection } from "@/lib/authorCollections"

import { AuthorCollectionTile } from "./AuthorCollectionTile"
import { SectionHeader } from "./SectionHeader"
import { pileTileWidth } from "./bookGridLayout"

/** How many author collections Home shows; "All" in the title row has the rest. */
export const HOME_AUTHOR_LIMIT = 6

/**
 * Home: the automatic author collections, three to a row (two rows). Renders nothing when
 * no author has two or more books.
 */
export function AuthorCollectionsSection({
  collections,
}: {
  collections: readonly AuthorCollection<BookWithRelations>[]
}) {
  const dimensions = useWindowDimensions()
  const insets = useSafeAreaInsets()

  if (collections.length === 0) return null

  // The Home scroll view pads 20px each side (or the safe area, if larger).
  const side = Math.max(20, insets.left, insets.right)
  // Same width maths as the Home book grids, so the columns line up.
  const cellWidth = pileTileWidth(dimensions.width - side * 2)
  const shown = collections.slice(0, HOME_AUTHOR_LIMIT)

  return (
    <View className="gap-2">
      <SectionHeader title="Authors" href="/author-collections" />
      <View className="-mx-1.5 flex-row flex-wrap">
        {shown.map((collection) => (
          <View key={collection.key} className="mx-1.5 my-1.5">
            <AuthorCollectionTile collection={collection} width={cellWidth} />
          </View>
        ))}
      </View>
    </View>
  )
}
