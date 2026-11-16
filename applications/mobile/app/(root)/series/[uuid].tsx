import { useLocalSearchParams } from "expo-router"
import { useMemo } from "react"

import { BookGrid } from "@/components/BookGrid"
import { SeriesGapGrid } from "@/components/SeriesGapGrid"
import { type BookWithRelations } from "@/database/books"
import { useGetSeriesQuery, useListBooksQuery } from "@/store/localApi"
import { layoutSeries } from "@/lib/seriesLayout"
import { type UUID } from "@/uuid"

const EMPTY_BOOKS: BookWithRelations[] = []

export default function SeriesScreen() {
  const { uuid } = useLocalSearchParams() as { uuid: UUID }

  const { data: books = EMPTY_BOOKS } = useListBooksQuery()
  const { data: series } = useGetSeriesQuery({ uuid })

  const booksBySeries = useMemo(
    () =>
      series
        ? books.filter((book) =>
            book.series.some((s) => s.uuid === series.uuid),
          )
        : [],
    [series, books],
  )

  const items = useMemo(
    () =>
      series
        ? layoutSeries(
            booksBySeries,
            (book) => book.series.find((s) => s.uuid === series.uuid)?.position,
          )
        : [],
    [series, booksBySeries],
  )

  if (!series) return null

  if (items.some((item) => item.type === "gap")) {
    return (
      <SeriesGapGrid title={series.name} items={items} books={booksBySeries} />
    )
  }

  return <BookGrid title={series.name} books={booksBySeries} />
}
