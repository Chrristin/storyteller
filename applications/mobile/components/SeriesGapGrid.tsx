import { type ReactNode } from "react"
import {
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { type BookWithRelations } from "@/database/books"
import { useListAllServerBooks } from "@/hooks/useListAllServerBooks"
import { type SeriesItem } from "@/lib/seriesLayout"

import { BookThumbnail } from "./BookThumbnail"
import { DriveSelectionBars } from "./DriveSelectionBars"
import { MiniPlayerWidget } from "./MiniPlayerWidget"
import { ScreenHeader } from "./ScreenHeader"
import { calculateBookGridLayout } from "./bookGridLayout"
import { Text } from "./ui/text"

/**
 * A series in order, with a dashed amber tile where a number is missing.
 * Only used for series that have gaps; the rest keep using BookGrid.
 */
export function SeriesGapGrid({
  title,
  items,
  books,
}: {
  title: string
  items: SeriesItem<BookWithRelations>[]
  books: BookWithRelations[]
}) {
  const dimensions = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { isLoading, refetch } = useListAllServerBooks()
  const { thumbnailWidth } = calculateBookGridLayout(
    dimensions.width - insets.left - insets.right,
  )
  const height = Math.round(thumbnailWidth * 1.5)

  const tiles: ReactNode[] = items.map((item) =>
    item.type === "book" ? (
      <View
        key={item.book.uuid}
        className="mx-1.5 my-1.5"
        style={{ width: thumbnailWidth }}
      >
        <BookThumbnail book={item.book} selectable width={thumbnailWidth} />
      </View>
    ) : (
      <View
        key={`gap-${item.position}`}
        accessibilityLabel={`Book ${item.position} is missing`}
        className="mx-1.5 my-1.5"
        style={{ width: thumbnailWidth }}
      >
        <View
          className="border-missing items-center justify-center gap-1 rounded-md border-2 border-dashed"
          style={{ width: thumbnailWidth, height }}
        >
          <Text className="text-missing text-lg font-bold">
            #{item.position}
          </Text>
          <Text className="text-missing text-xs">Missing</Text>
        </View>
      </View>
    ),
  )

  return (
    <ScreenHeader
      title={title}
      right={
        <Text className="text-muted-foreground text-sm">
          {books.length} books
        </Text>
      }
    >
      <ScrollView
        className="w-full flex-1"
        contentContainerClassName="px-safe-or-3 flex-row flex-wrap"
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
        }
      >
        {tiles}
        <View className="h-40 w-full" />
      </ScrollView>
      <MiniPlayerWidget />
      <DriveSelectionBars books={books} />
    </ScreenHeader>
  )
}
