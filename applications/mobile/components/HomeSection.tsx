import { type HrefObject } from "expo-router"
import { View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { type BookWithRelations } from "@/database/books"
import { useLibraryLook } from "@/lib/libraryLook"
import { sectionView } from "@/lib/homeSections"

import { BookThumbnail } from "./BookThumbnail"
import { calculateBookGridLayout } from "./bookGridLayout"
import { SectionHeader } from "./SectionHeader"

interface Props {
  title: string
  books: readonly BookWithRelations[]
  limit: number
  href: HrefObject
}

/**
 * A Home section: a title row with "All" on the right, then a three column
 * grid of the first few books. Renders nothing when there are no books.
 */
export function HomeSection({ title, books, limit, href }: Props) {
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
      <SectionHeader title={title} href={href} />
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
    </View>
  )
}
