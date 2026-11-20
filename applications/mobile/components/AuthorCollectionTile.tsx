import { useRouter } from "expo-router"

import { type BookWithRelations } from "@/database/books"
import {
  type AuthorCollection,
  authorCollectionLabel,
} from "@/lib/authorCollections"

import { SwipePile } from "./SwipePile"
import { Text } from "./ui/text"

/** An automatic author collection as a swipeable pile with its label. */
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
    <SwipePile
      books={collection.books}
      count={collection.books.length}
      width={width}
      label={`${collection.name}, ${label}`}
      openLabel={collection.name}
      onOpen={() =>
        router.push({
          pathname: "/author-collection/[author]",
          params: { author: collection.key },
        })
      }
    >
      <Text className="text-sm font-semibold" numberOfLines={1}>
        {collection.name}
      </Text>
      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
        {label}
      </Text>
    </SwipePile>
  )
}
