import { useLocalSearchParams } from "expo-router"
import { useMemo } from "react"

import { BookGrid } from "@/components/BookGrid"
import { type BookWithRelations } from "@/database/books"
import {
  filterRecentlyCompleted,
  filterToRead,
  sortRecentlyAdded,
} from "@/lib/homeSections"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []

type ShelfType = "currently-reading" | "start-reading" | "to-read" | "completed"

const SHELF_TITLES: Record<ShelfType, string> = {
  "currently-reading": "Continue",
  "start-reading": "Recently Added",
  "to-read": "To Read",
  completed: "Recently Completed",
}

export function filterCurrentlyReading(books: BookWithRelations[]) {
  return books
    .filter((book) => book.status?.name === "Reading")
    .sort((a, b) => (b.position?.timestamp ?? 0) - (a.position?.timestamp ?? 0))
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
