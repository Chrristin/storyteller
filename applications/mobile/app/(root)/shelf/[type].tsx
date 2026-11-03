import { useLocalSearchParams } from "expo-router"
import { useMemo } from "react"

import { BookGrid } from "@/components/BookGrid"
import { type BookWithRelations } from "@/database/books"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []

type ShelfType = "currently-reading" | "start-reading"

const SHELF_TITLES: Record<ShelfType, string> = {
  "currently-reading": "Continue",
  "start-reading": "Up next",
}

export function filterCurrentlyReading(books: BookWithRelations[]) {
  return books
    .filter((book) => book.status?.name === "Reading")
    .sort((a, b) => (b.position?.timestamp ?? 0) - (a.position?.timestamp ?? 0))
}

export function filterStartReading(books: BookWithRelations[]) {
  return books
    .filter((book) => book.status?.name === "To read")
    .sort(
      (a, b) =>
        new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf(),
    )
}

const SHELF_FILTERS: Record<
  ShelfType,
  (books: BookWithRelations[]) => BookWithRelations[]
> = {
  "currently-reading": filterCurrentlyReading,
  "start-reading": filterStartReading,
}

export default function ShelfScreen() {
  const { type } = useLocalSearchParams() as { type: ShelfType }
  const { data: books = EMPTY_BOOKS } = useListBooksQuery()

  const title = SHELF_TITLES[type] ?? type
  const filterFn = SHELF_FILTERS[type]

  const filteredBooks = useMemo(
    () => (filterFn ? filterFn(books) : []),
    [filterFn, books],
  )

  return <BookGrid title={title} books={filteredBooks} />
}
