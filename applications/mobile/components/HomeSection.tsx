import { type HrefObject, useRouter } from "expo-router"
import { View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { type BookWithRelations } from "@/database/books"
import { useLibraryLook } from "@/lib/libraryLook"
import { sectionView } from "@/lib/homeSections"

import { BookThumbnail } from "./BookThumbnail"
import { calculateBookGridLayout } from "./bookGridLayout"
import { Button } from "./ui/button"
import { Text } from "./ui/text"

interface Props {
  title: string
  books: readonly BookWithRelations[]
  limit: number
  buttonLabel: string
  href: HrefObject
}

/**
 * A Home section: a heading, a three column grid of the first few books and
 * one button to the full list. Renders nothing when there are no books.
 */
export function HomeSection({ title, books, limit, buttonLabel, href }: Props) {
  const router = useRouter()
  const dimensions = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [{ showTitles }] = useLibraryLook()

  const view = sectionView(books, limit)
  if (!view) return null

  // The Home scroll view pads 20px each side (or the safe area, if larger).
  // BookGrid pads its grid 12px, so asking the shared grid maths for a width
  // 36px wider than our content gives thumbnails that exactly fill the row.
  const sidePadding = Math.max(20, insets.left, insets.right)
  const contentWidth = dimensions.width - sidePadding * 2
  const { thumbnailWidth } = calculateBookGridLayout(contentWidth + 36)

  return (
    <View className="gap-2">
      <Text className="text-[15px] font-semibold">{title}</Text>
      <View className="-mx-1.5 flex-row flex-wrap">
        {view.shown.map((book) => (
          <View
            key={book.uuid}
            className={showTitles ? "mx-1.5 my-2" : "mx-1.5 my-1.5"}
            style={{ width: thumbnailWidth }}
          >
            <BookThumbnail book={book} selectable width={thumbnailWidth} />
          </View>
        ))}
      </View>
      {view.hasMore && (
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-full"
          accessibilityLabel={`${buttonLabel}: ${title}`}
          onPress={() => router.push(href)}
        >
          <Text>{buttonLabel}</Text>
        </Button>
      )}
    </View>
  )
}
