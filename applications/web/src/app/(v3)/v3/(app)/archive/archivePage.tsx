"use client"

import { BookListPage } from "@v3/_/components/books/BookListPage"

/**
 * The Archive ("the backroom"): books set aside for everyone. They stay in the
 * library with all their files but are hidden everywhere else. Select books and
 * use the Actions menu to move them back to the library or delete them.
 *
 * Sorted by author (spelling variants together), then series and title. The
 * sort control still works as on any other list.
 */
export default function ArchivePage() {
  return (
    <BookListPage
      source={{ kind: "books", archived: "only" }}
      defaultSort={{ field: "authors", direction: "asc" }}
      breadcrumbs={[
        {
          render: (
            <h1 className="font-heading text-foreground truncate text-lg font-normal md:text-xl">
              Archive
            </h1>
          ),
        },
      ]}
      description="Books you keep but set aside. They are not shown anywhere else. Select books and use the Actions menu to move them back to the library."
      emptyMessage="The Archive is empty"
      emptySubMessage="Books you move to the Archive show up here."
      emptyFilteredSubMessage="Try adjusting your search or filters"
    />
  )
}
