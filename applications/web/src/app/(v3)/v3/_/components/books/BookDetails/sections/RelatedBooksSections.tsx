"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { BookCard } from "@v3/_/components/books/Grid/BookCard"
import { useBookInSidePanel } from "@v3/_/hooks/use-open-book"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { useBookForm } from "@/app/(v3)/v3/_/components/books/BookDetails/BookFormProvider"
import { useUserPreferences } from "@/app/(v3)/v3/_/components/user-preferences-provider"
import { type BookWithRelations } from "@/database/books"
import { type DisplayField } from "@/sort"
import { useListInfiniteBooksInfiniteQuery } from "@/store/api"

import { CollapsibleSection } from "./CollapsibleSection"

const RELATED_LIMIT = 20

// Three books are shown; the rest are behind "Show more". No sideways scroll.
const RELATED_PREVIEW = 3

function RelatedBooksRow({
  books,
  displayFields,
}: {
  books: BookWithRelations[]
  displayFields: DisplayField[]
}) {
  const c = useCommon()
  const [expanded, setExpanded] = useState(false)

  const { bookOpenTarget } = useUserPreferences()
  const { setSelectedBookUuid, selectedBookUuid } = useBookInSidePanel()
  const isInSidePanel = !!selectedBookUuid

  const router = useRouter()

  const handleClick = (book: BookWithRelations) => {
    if (isInSidePanel && bookOpenTarget === "panel") {
      void setSelectedBookUuid(book.uuid)
      return
    }

    router.push(`/books/${book.uuid}`)
  }

  const visible = expanded ? books : books.slice(0, RELATED_PREVIEW)

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-3">
        {visible.map((book) => (
          <div key={book.uuid} className="min-w-0">
            <BookCard
              book={book}
              displayFields={displayFields}
              onClick={handleClick}
              gridCardSize="smallest"
            />
          </div>
        ))}
      </div>

      {books.length > RELATED_PREVIEW && (
        <button
          type="button"
          onClick={() => {
            setExpanded((value) => !value)
          }}
          className="text-cover-accent self-start text-xs leading-5 font-medium hover:underline"
        >
          {expanded ? c("actions.showLess") : c("actions.showMore")}
        </button>
      )}
    </div>
  )
}

export function MoreByAuthorSection() {
  const { book } = useBookForm()
  const t = useTranslation("BookDetailsPage")

  const author = book.authors[0] ?? null

  const { data } = useListInfiniteBooksInfiniteQuery(
    {
      limit: RELATED_LIMIT,
      orderBy: "publicationDate",
      orderDirection: "desc",
      filter: {
        type: "condition",
        field: "creators",
        operator: "includes",
        value: [author?.uuid ?? ""],
        qualifier: "aut",
      },
    },
    { skip: !author },
  )

  const books = (data?.pages[0] ?? []).filter(
    (other) => other.uuid !== book.uuid,
  )

  if (!author || books.length === 0) return null

  return (
    <CollapsibleSection
      title={t.plain("moreByAuthor", { name: author.name.trim() })}
      sectionKey="moreByAuthor"
    >
      <RelatedBooksRow books={books} displayFields={["title"]} />
    </CollapsibleSection>
  )
}

export function MoreInSeriesSection() {
  const { book } = useBookForm()
  const t = useTranslation("BookDetailsPage")

  const series = book.series[0] ?? null

  const { data } = useListInfiniteBooksInfiniteQuery(
    {
      limit: RELATED_LIMIT,
      orderBy: "seriesPosition",
      orderDirection: "asc",
      series: series?.uuid,
      filter: {
        type: "condition",
        field: "series",
        operator: "includes",
        value: [series?.uuid ?? ""],
      },
    },
    { skip: !series },
  )

  const books = (data?.pages[0] ?? []).filter(
    (other) => other.uuid !== book.uuid,
  )

  if (!series || books.length === 0) return null

  return (
    <CollapsibleSection
      title={t.plain("moreInSeries", { name: series.name.trim() })}
      sectionKey="moreInSeries"
    >
      <RelatedBooksRow
        books={books}
        displayFields={["seriesPosition", "title"]}
      />
    </CollapsibleSection>
  )
}
