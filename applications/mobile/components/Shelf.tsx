import { type HrefObject } from "expo-router"
import { FlatList } from "react-native-gesture-handler"

import { type BookWithRelations } from "@/database/books"

import { BookThumbnail } from "./BookThumbnail"
import { SectionHeader } from "./SectionHeader"
import { Stack } from "./ui/Stack"

interface Props {
  label: string
  href?: string | HrefObject | undefined
  books: BookWithRelations[]
  /** Show a thin progress line under books that are in progress. */
  showProgress?: boolean
}

/** Every cover in a row is the same size, with 12px between books. */
const COVER_WIDTH = 104

export function Shelf({ label, href, books, showProgress = false }: Props) {
  if (!books.length) return null

  return (
    <Stack className="gap-2">
      <SectionHeader title={label} href={href} />

      <FlatList
        horizontal
        data={books.slice(0, 25)}
        contentContainerClassName="gap-3 py-1.5 pr-5"
        showsHorizontalScrollIndicator={false}
        renderItem={({ item: book }) => (
          <BookThumbnail
            book={book}
            showProgress={showProgress}
            selectable
            width={COVER_WIDTH}
          />
        )}
      />
    </Stack>
  )
}
