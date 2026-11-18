"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { SiteHeader } from "@v3/_/components/site-header"
import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { ConfirmDialog } from "@v3/_/components/ui/confirm-dialog"
import {
  PageContent,
  PageHeader,
  PageLayout,
  PageMain,
} from "@v3/_/components/ui/page-layout"
import { Spinner } from "@v3/_/components/ui/spinner"
import { V3Link } from "@v3/_/components/v3-link"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import { type ReviewItem } from "@/database/hardcoverIdentity"
import { normaliseAuthorName } from "@/nameKey"
import {
  useAcceptAllHardcoverMutation,
  useGetHardcoverIdentifyQuery,
  useGetHardcoverReviewQuery,
} from "@/store/api"

type Tab = "sure" | "check" | "none" | "accepted"

const TABS: Tab[] = ["sure", "check", "none", "accepted"]

const TAB_LABEL = {
  sure: "tabSure",
  check: "tabCheck",
  none: "tabNone",
  accepted: "tabAccepted",
} as const

const EMPTY_LABEL = {
  sure: "emptySure",
  check: "emptyCheck",
  none: "emptyNone",
  accepted: "emptyAccepted",
} as const

type Group = { key: string; series: string | null; items: ReviewItem[] }

function groupBySeries(items: ReviewItem[], flat: boolean): Group[] {
  if (flat) return [{ key: "all", series: null, items }]
  const groups: Group[] = []
  for (const item of items) {
    const key = item.suggestedSeries ?? ""
    const last = groups.at(-1)
    if (last?.key === key) {
      last.items.push(item)
    } else {
      groups.push({ key, series: item.suggestedSeries, items: [item] })
    }
  }
  return groups
}

function authorsDiffer(item: ReviewItem) {
  if (item.matchedAuthors.length === 0 || item.authors.length === 0) {
    return false
  }
  const ours = item.authors.map(normaliseAuthorName)
  return !item.matchedAuthors.some((name) =>
    ours.includes(normaliseAuthorName(name)),
  )
}

function ReviewRow({ item, tab }: { item: ReviewItem; tab: Tab }) {
  const t = useTranslation("IdentifyPage")
  const showSuggestion = tab !== "none"

  return (
    <div className="grid grid-cols-[1.5fr_1fr_1.3fr_3.5rem] items-start gap-3 border-t py-2 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium">{item.title}</div>
        {showSuggestion && item.genres.length > 0 && (
          <div className="text-muted-foreground truncate text-xs">
            {t.plain("genres", { genres: item.genres.join(", ") })}
            {item.moods.length > 0 &&
              ` · ${t.plain("moods", { moods: item.moods.join(", ") })}`}
          </div>
        )}
        {tab === "check" && item.matchedTitle && (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            {t.plain("hardcoverCalls", { title: item.matchedTitle })}
          </div>
        )}
        {showSuggestion && authorsDiffer(item) && (
          <div className="text-muted-foreground text-xs">
            {t.plain("hardcoverAuthors", {
              authors: item.matchedAuthors.join(", "),
            })}
          </div>
        )}
      </div>
      <div className="text-muted-foreground min-w-0 truncate">
        {item.currentSeries.length > 0
          ? item.currentSeries.join(", ")
          : t("noSeriesNow")}
      </div>
      <div className="min-w-0 truncate">
        {showSuggestion
          ? (item.suggestedSeries ?? (
              <span className="text-muted-foreground">
                {t("noSeriesSuggested")}
              </span>
            ))
          : ""}
      </div>
      <div className="text-muted-foreground tabular-nums">
        {showSuggestion && item.suggestedPosition !== null
          ? `#${item.suggestedPosition}`
          : t("noPosition")}
      </div>
    </div>
  )
}

function ReviewGroupCard({ group, tab }: { group: Group; tab: Tab }) {
  const t = useTranslation("IdentifyPage")
  const authors = group.items[0]?.authors ?? []
  const badge =
    tab === "sure"
      ? {
          label: t("badgeSure"),
          className: "text-emerald-600 dark:text-emerald-400",
        }
      : tab === "check"
        ? {
            label: t("badgeCheck"),
            className: "text-amber-600 dark:text-amber-400",
          }
        : tab === "accepted"
          ? { label: t("badgeAccepted"), className: "text-muted-foreground" }
          : null

  return (
    <section className="bg-card rounded-xl border p-4">
      {group.series !== null && (
        <header className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold">
            {group.series}
          </h2>
          {authors.length > 0 && (
            <span className="text-muted-foreground text-xs">
              {t("authorsBy", { authors: authors.join(", ") })}
            </span>
          )}
          {badge && (
            <Badge variant="outline" className={badge.className}>
              {badge.label}
            </Badge>
          )}
        </header>
      )}
      <div className="text-muted-foreground grid grid-cols-[1.5fr_1fr_1.3fr_3.5rem] gap-3 py-1.5 text-[0.6875rem] tracking-wide uppercase">
        <div>{t("columnBook")}</div>
        <div>{t("columnSeriesNow")}</div>
        <div>{tab === "none" ? "" : t("columnSuggested")}</div>
        <div>{tab === "none" ? "" : t("columnPosition")}</div>
      </div>
      {group.items.map((item) => (
        <ReviewRow key={item.bookUuid} item={item} tab={tab} />
      ))}
    </section>
  )
}

function ReviewList({ tab }: { tab: Tab }) {
  const t = useTranslation("IdentifyPage")
  const [cursor, setCursor] = useState<string | undefined>()
  const [loaded, setLoaded] = useState<Map<string, ReviewItem>>(new Map())
  const { data, isFetching, isError } = useGetHardcoverReviewQuery({
    status: tab,
    ...(cursor ? { cursor } : {}),
  })

  // Pages are added to what is already on screen, so a series that runs over
  // a page boundary stays in one group.
  useEffect(() => {
    if (!data) return
    setLoaded((current) => {
      const next = new Map(current)
      for (const item of data.items) next.set(item.bookUuid, item)
      return next
    })
  }, [data])

  const items = useMemo(() => [...loaded.values()], [loaded])
  const groups = useMemo(
    () => groupBySeries(items, tab === "none"),
    [items, tab],
  )

  if (isError) {
    return <p className="text-destructive text-sm">{t("loadFailed")}</p>
  }
  if (!data && isFetching) return <Spinner />
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t(EMPTY_LABEL[tab])}</p>
    )
  }

  return (
    <div className="space-y-3">
      {tab === "check" && (
        <p className="text-muted-foreground text-xs">{t("checkNote")}</p>
      )}
      {tab === "none" && (
        <p className="text-muted-foreground text-xs">{t("noneNote")}</p>
      )}
      {groups.map((group) => (
        <ReviewGroupCard key={group.key || "none"} group={group} tab={tab} />
      ))}
      {data?.nextCursor && (
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={isFetching}
          onClick={() => {
            setCursor(data.nextCursor ?? undefined)
          }}
        >
          {isFetching && <Spinner className="size-3.5" />}
          {t("showMore")}
        </Button>
      )}
    </div>
  )
}

export function IdentifyPage() {
  const t = useTranslation("IdentifyPage")
  const [tab, setTab] = useState<Tab>("sure")
  const [resetKey, setResetKey] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const { data: status } = useGetHardcoverIdentifyQuery()
  const [acceptAll, { isLoading: isAccepting }] =
    useAcceptAllHardcoverMutation()

  const counts = status?.counts
  const sureCount = counts?.sure ?? 0
  const looked = counts
    ? counts.sure + counts.check + counts.none + counts.accepted
    : 0

  const count = (value: Tab) => counts?.[value] ?? 0

  const handleAccept = async () => {
    try {
      const result = await acceptAll().unwrap()
      toast.success(
        t.plain("acceptedToast", {
          seriesAdded: result.seriesAdded,
          tagsAdded: result.tagsAdded,
          skipped: result.skipped,
        }),
      )
      setResetKey((key) => key + 1)
    } catch {
      toast.error(t.plain("acceptFailed"))
    }
  }

  return (
    <PageLayout>
      <PageMain>
        <PageHeader>
          <SiteHeader
            breadcrumbs={[{ label: t.plain("title") }]}
            actions={
              <Button
                type="button"
                className="rounded-full"
                disabled={sureCount === 0 || isAccepting}
                onClick={() => {
                  setConfirming(true)
                }}
              >
                {isAccepting && <Spinner className="size-3.5" />}
                {t("acceptAll")}
              </Button>
            }
          />
        </PageHeader>
        <PageContent className="p-4">
          <div className="max-w-4xl space-y-4">
            <p className="text-muted-foreground text-sm">
              {t("summary", { count: looked })}{" "}
              <V3Link
                href="/settings?tab=metadata&section=hardcoverIdentify"
                className="hover:text-foreground underline underline-offset-2"
              >
                {t("settingsLink")}
              </V3Link>
            </p>

            <div className="flex flex-wrap gap-2" role="tablist">
              {TABS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => {
                    setTab(value)
                  }}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium",
                    tab === value
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "hover:bg-muted/50",
                  )}
                >
                  {t(TAB_LABEL[value])} {count(value).toLocaleString()}
                </button>
              ))}
            </div>

            <ReviewList key={`${tab}-${resetKey}`} tab={tab} />
          </div>
        </PageContent>
      </PageMain>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.plain("confirmTitle", { count: sureCount })}
        description={t.plain("confirmDescription", { count: sureCount })}
        confirmLabel={t.plain("confirmLabel")}
        isLoading={isAccepting}
        onConfirm={handleAccept}
      />
    </PageLayout>
  )
}
