import { useRouter } from "expo-router"
import { Pressable } from "react-native"

import { type BookWithRelations } from "@/database/books"
import {
  type AuthorCollection,
  authorCollectionLabel,
} from "@/lib/authorCollections"

import { PileStack } from "./PileStack"
import { Text } from "./ui/text"

/** An automatic author collection as a stack of covers with its label. */
export function AuthorCollectionTile({
  collection,
  width,
}: {
  collection: AuthorCollection<BookWithRelations>
  width: number
}) {
  const router = useRouter()
  const label = authorCollectionLabel(collection)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${collection.name}, ${label}`}
      className="pt-2 pb-4"
      style={{ width }}
      onPress={() =>
        router.push({
          pathname: "/author-collection/[author]",
          params: { author: collection.key },
        })
      }
    >
      <PileStack covers={collection.covers} width={width} />
      <Text className="mt-3 text-sm font-semibold" numberOfLines={1}>
        {collection.name}
      </Text>
      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}
