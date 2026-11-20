import { useMemo } from "react"

import { BookGrid } from "@/components/BookGrid"
import { type BookWithRelations } from "@/database/books"
import { ARCHIVE_EMPTY, ARCHIVE_TITLE } from "@/lib/archive"
import { sortArchiveBooks } from "@/lib/archiveOrder"
import { useListArchivedBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []

/** The backroom: books moved to the Archive, ordered by author. */
export default function ArchiveScreen() {
  const { data: books = EMPTY_BOOKS } = useListArchivedBooksQuery()
  const sorted = useMemo(() => sortArchiveBooks(books), [books])

  return (
    <BookGrid
      title={ARCHIVE_TITLE}
      books={sorted}
      selectionMode="archive"
      emptyText={ARCHIVE_EMPTY}
    />
  )
}
