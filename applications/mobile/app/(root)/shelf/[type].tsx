import { useLocalSearchParams } from "expo-router"
import { useMemo } from "react"

import { BookGrid } from "@/components/BookGrid"
import { type BookWithRelations } from "@/database/books"
import {
  filterRecentlyCompleted,
  filterToRead,
  sortRecentlyAdded,
} from "@/lib/homeSections"
import { NOW_READING_TITLE, sortInProgress } from "@/lib/nowReading"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []

type ShelfType = "currently-reading" | "start-reading" | "to-read" | "completed"

const SHELF_TITLES: Record<ShelfType, string> = {
  "currently-reading": NOW_READING_TITLE,
  "start-reading": "Recently Added",
  "to-read": "To Read",
  completed: "Recently Completed",
}

export function filterCurrentlyReading(books: BookWithRelations[]) {
  return sortInProgress(books.filter((book) => book.status?.name === "Reading"))
}

const SHELF_FILTERS: Record<
  ShelfType,
  (books: BookWithRelations[]) => BookWithRelations[]
> = {
  "currently-reading": filterCurrentlyReading,
  "start-reading": sortRecentlyAdded,
  "to-read": filterToRead,
  completed: filterRecentlyCompleted,
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
