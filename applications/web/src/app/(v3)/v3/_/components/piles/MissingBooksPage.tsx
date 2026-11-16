"use client"

import {
  PageContent,
  PageLayout,
  PageMain,
} from "@v3/_/components/ui/page-layout"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { V3Link } from "@v3/_/components/v3-link"
import { DocumentTitle } from "@v3/_/hooks/use-document-title"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { SiteHeader } from "@/app/(v3)/v3/_/components/site-header"
import { cn } from "@/cn"
import { type SeriesGap } from "@/seriesGaps"
import { useGetSeriesGapsQuery } from "@/store/api"

export default function MissingBooksPage() {
  const t = useTranslation("MissingBooksPage")
  const { data: gaps, isLoading } = useGetSeriesGapsQuery()

  return (
    <PageLayout>
      <DocumentTitle parts={[t.plain("title")]} />
      <PageMain>
        <SiteHeader
          breadcrumbs={[
            { label: t.plain("piles"), url: "/piles" },
            { label: t.plain("title") },
          ]}
        />
        <PageContent className="p-6 pt-0">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !gaps || gaps.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              {t("empty")}
            </p>
          ) : (
            <ul className="flex max-w-3xl flex-col gap-3">
              {gaps.map((gap) => (
                <li key={gap.uuid}>
                  <GapRow gap={gap} />
                </li>
              ))}
            </ul>
          )}
        </PageContent>
      </PageMain>
    </PageLayout>
  )
}

function GapRow({ gap }: { gap: SeriesGap }) {
  const t = useTranslation("MissingBooksPage")
  const owned = new Set(gap.owned)
  const positions = Array.from({ length: gap.upTo }, (_, i) => i + 1)

  return (
    <V3Link
      href={`/series?item=${gap.uuid}`}
      className="bg-card hover:bg-accent/50 focus-visible:ring-ring/50 block rounded-lg border p-4 transition-colors outline-none focus-visible:ring-[3px]"
    >
      <div className="truncate text-sm font-medium">{gap.name}</div>
      {gap.authors.length > 0 && (
        <div className="text-muted-foreground truncate text-xs">
          {gap.authors.join(", ")}
        </div>
      )}
      <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
        {t("missingList", {
          positions: gap.missing.map((n) => `#${n}`).join(", "),
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {positions.map((n) => (
          <span
            key={n}
            title={owned.has(n) ? `#${n}` : t.plain("missingTitle", { n })}
            className={cn(
              "flex size-6 items-center justify-center rounded-sm text-[0.6875rem] font-medium",
              owned.has(n)
                ? "bg-primary text-primary-foreground"
                : "border border-dashed border-amber-500 text-amber-600 dark:text-amber-400",
            )}
          >
            {n}
          </span>
        ))}
      </div>
    </V3Link>
  )
}
