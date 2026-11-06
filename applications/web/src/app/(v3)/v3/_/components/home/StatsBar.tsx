"use client"

import { useTranslation } from "@v3/_/hooks/use-translation"

import { V3Link } from "@/app/(v3)/v3/_/components/v3-link"
import { STATUS_READING } from "@/database/statusKinds"
import { useGetHomeStatsQuery, useListStatusesQuery } from "@/store/api"

type Tile = {
  key: string
  value: number
  label: string
  href?: string
  detail?: string
}

function StatsSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl @2xl/main:grid-cols-4">
      <div className="bg-muted/40 px-5 py-5">
        <div className="bg-muted/40 h-20 w-full" />
      </div>
      <div className="bg-muted/40 px-5 py-5">
        <div className="bg-muted/40 h-20 w-full" />
      </div>
      <div className="bg-muted/40 px-5 py-5">
        <div className="bg-muted/40 h-20 w-full" />
      </div>
      <div className="bg-muted/40 px-5 py-5">
        <div className="bg-muted/40 h-20 w-full" />
      </div>
    </section>
  )
}

export function StatsBar({ compact = false }: { compact?: boolean }) {
  const t = useTranslation("HomePage")
  const { data: stats, isLoading } = useGetHomeStatsQuery()
  const { data: statuses, isLoading: isStatusesLoading } =
    useListStatusesQuery()

  if (isLoading || isStatusesLoading) return compact ? null : <StatsSkeleton />

  if (!stats || !statuses) return null
  const readingStatus = statuses.find((s) => s.name === STATUS_READING)

  const tiles = [
    {
      key: "inProgress",
      value: stats.inProgress,
      label: t("stats.inProgress"),
      href: readingStatus ? `/statuses?item=${readingStatus.uuid}` : "/books",
    },
    {
      key: "finishedThisYear",
      value: stats.finishedThisYear,
      label: t("stats.finishedThisYear"),
    },
    {
      key: "inLibrary",
      value: stats.inLibrary,
      label: t("stats.inLibrary"),
      href: "/books",
    },
    {
      key: "tags",
      value: stats.tags,
      label: t("stats.tags"),
      detail: t("stats.authors", { count: stats.authors }),
      href: "/tags",
    },
  ] satisfies Tile[]

  if (compact) {
    return (
      <section
        aria-label="Library stats"
        className="pointer-events-auto hidden items-center gap-4 text-xs md:flex"
      >
        {tiles.map((tile) => {
          const content = (
            <>
              <span className="text-primary font-medium">{tile.value}</span>{" "}
              <span className="text-muted-foreground">{tile.label}</span>
            </>
          )
          return tile.href ? (
            <V3Link
              key={tile.key}
              href={tile.href}
              className="hover:text-foreground whitespace-nowrap"
            >
              {content}
            </V3Link>
          ) : (
            <span key={tile.key} className="whitespace-nowrap">
              {content}
            </span>
          )
        })}
      </section>
    )
  }

  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl @2xl/main:grid-cols-4">
      {tiles.map((tile) => {
        return <Tile key={tile.key} tile={tile} />
      })}
    </section>
  )
}

const Tile = ({ tile }: { tile: Tile }) => {
  const content = (
    <>
      <p className="font-heading text-primary text-xl leading-none font-medium @xl/main:text-xl">
        {tile.value}
      </p>
      <p className="text-muted-foreground mt-2 text-xs font-medium tracking-[0.12em] uppercase">
        {tile.label}
      </p>
      {tile.detail && (
        <p className="text-muted-foreground/70 mt-1 text-xs">{tile.detail}</p>
      )}
    </>
  )

  if (tile.href) {
    return (
      <V3Link href={tile.href} className="bg-muted/40 px-5 py-5">
        {content}
      </V3Link>
    )
  }

  return <div className="bg-muted/40 px-5 py-5">{content}</div>
}
