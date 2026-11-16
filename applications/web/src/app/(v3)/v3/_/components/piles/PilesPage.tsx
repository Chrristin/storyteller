"use client"

import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useMemo, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  PageContent,
  PageLayout,
  PageMain,
} from "@v3/_/components/ui/page-layout"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@v3/_/components/ui/tabs"
import { V3Link } from "@v3/_/components/v3-link"
import { DocumentTitle } from "@v3/_/hooks/use-document-title"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { SiteHeader } from "@/app/(v3)/v3/_/components/site-header"
import * as icon from "@/icons"
import { type PileKind, buildPiles } from "@/piles"
import { useGetSeriesGapsQuery, useListBooksQuery } from "@/store/api"

import { PilesStack } from "./PilesStack"

const TABS = ["series", "authors"] as const
const PAGE_SIZE = 48

export default function PilesPage() {
  const t = useTranslation("PilesPage")
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("series"),
  )
  const kind: PileKind = tab === "series" ? "series" : "author"

  // One request for the whole library, shared with the rest of the app. The
  // piles are built from it, so no per-series or per-author fetching.
  const { data: books, isLoading } = useListBooksQuery()
  const { data: gaps } = useGetSeriesGapsQuery()

  const piles = useMemo(() => {
    if (!books) return []
    const missingBySeries = new Map(
      (gaps ?? []).map((gap) => [gap.uuid, gap.missing.length]),
    )
    return buildPiles(books, kind, missingBySeries)
  }, [books, gaps, kind])

  const [shown, setShown] = useState(PAGE_SIZE)
  const visible = piles.slice(0, shown)

  return (
    <PageLayout>
      <DocumentTitle parts={[t.plain("title")]} />
      <PageMain>
        <SiteHeader
          breadcrumbs={[{ label: t.plain("title") }]}
          actions={
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<V3Link href="/missing" />}
            >
              <icon.AlertCircle />
              {t("missingBooksLink")}
            </Button>
          }
        />
        <PageContent className="p-6 pt-0">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              void setTab(value as (typeof TABS)[number])
              setShown(PAGE_SIZE)
            }}
          >
            <TabsList>
              <TabsTrigger value="series">{t("tabs.series")}</TabsTrigger>
              <TabsTrigger value="authors">{t("tabs.authors")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <PilesGrid>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </PilesGrid>
          ) : piles.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              {tab === "series" ? t("emptySeries") : t("emptyAuthors")}
            </p>
          ) : (
            <>
              <PilesGrid>
                {visible.map((pile) => (
                  <PilesStack key={`${pile.kind}:${pile.uuid}`} pile={pile} />
                ))}
              </PilesGrid>
              {piles.length > shown && (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShown((n) => n + PAGE_SIZE)
                    }}
                  >
                    {t("showMore")}
                  </Button>
                </div>
              )}
            </>
          )}
        </PageContent>
      </PageMain>
    </PageLayout>
  )
}

function PilesGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-8">
      {children}
    </div>
  )
}
