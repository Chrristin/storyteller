"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@v3/_/components/ui/button"
import { Spinner } from "@v3/_/components/ui/spinner"
import { V3Link } from "@v3/_/components/v3-link"
import { useTranslation } from "@v3/_/hooks/use-translation"

import {
  useGetHardcoverIdentifyQuery,
  useRunHardcoverIdentifyMutation,
  useStopHardcoverIdentifyMutation,
} from "@/store/api"

import { SettingsCard, SettingsLink, SettingsSection } from "./shared"

const POLL_MS = 3_000
// The job waits about 1.4 seconds between books, plus the request itself.
const SECONDS_PER_BOOK = 1.5

function Count({
  value,
  label,
  tone,
}: {
  value: number
  label: string
  tone: string
}) {
  return (
    <div className="bg-background flex-1 rounded-lg border px-3 py-2.5">
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-muted-foreground mt-0.5 text-xs">{label}</div>
    </div>
  )
}

function TokenStatus({ configured }: { configured: boolean }) {
  const t = useTranslation(
    "SettingsPage.tabs.metadata.sections.hardcoverIdentify",
  )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={
          configured
            ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground text-sm"
        }
      >
        {configured ? t("tokenSaved") : t("tokenMissing")}
      </span>
      <SettingsLink section="metadataProviders">{t("tokenLink")}</SettingsLink>
    </div>
  )
}

export function HardcoverIdentifySection() {
  const t = useTranslation(
    "SettingsPage.tabs.metadata.sections.hardcoverIdentify",
  )
  const [pollingInterval, setPollingInterval] = useState(0)
  const { data } = useGetHardcoverIdentifyQuery(undefined, { pollingInterval })
  const [run, { isLoading: isStarting }] = useRunHardcoverIdentifyMutation()
  const [stop, { isLoading: isStopping }] = useStopHardcoverIdentifyMutation()

  const running = !!data?.running
  // Poll only while a run is going.
  useEffect(() => {
    setPollingInterval(running ? POLL_MS : 0)
  }, [running])

  const start = (mode: "new" | "all") => {
    void run({ mode })
      .unwrap()
      .catch(() => {
        toast.error(t.plain("startFailed"))
      })
  }

  const progress = data?.progress
  const counts = data?.counts
  const total = progress?.total ?? 0
  const done = progress?.done ?? 0
  const percent =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const minutesLeft = Math.max(
    1,
    Math.ceil(((total - done) * SECONDS_PER_BOOK) / 60),
  )
  const hasRun = !!progress?.startedAt

  return (
    <SettingsSection id="hardcoverIdentify">
      <SettingsCard title={t("title")} description={t("description")}>
        {data && <TokenStatus configured={data.configured} />}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="rounded-full"
            disabled={!data?.configured || running || isStarting}
            onClick={() => {
              start("new")
            }}
          >
            {isStarting && <Spinner className="size-3.5" />}
            {t("identifyNew")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            title={t.plain("checkAgainTip")}
            disabled={!data?.configured || running || isStarting}
            onClick={() => {
              start("all")
            }}
          >
            {t("checkAgain")}
          </Button>
          {running && (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              disabled={isStopping}
              onClick={() => {
                void stop()
              }}
            >
              {t("stop")}
            </Button>
          )}
          {data && !data.configured && (
            <span className="text-muted-foreground text-xs">
              {t("needToken")}
            </span>
          )}
        </div>

        {(running || hasRun) && progress && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {running ? t("workingTitle") : t("idleTitle")}
            </p>
            <div
              className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {running
                ? `${t.plain("progress", { done, total })} ${t.plain("minutesLeft", { minutes: minutesLeft })}`
                : t.plain(
                    progress.done < progress.total ? "stopped" : "finished",
                    {
                      done,
                      total,
                    },
                  )}
            </p>
            {!running && progress.lastError && (
              <p className="text-destructive text-xs">{progress.lastError}</p>
            )}
          </div>
        )}

        {counts && (
          <div className="flex gap-2">
            <Count
              value={counts.sure}
              label={t.plain("countSure")}
              tone="text-emerald-600 dark:text-emerald-400"
            />
            <Count
              value={counts.check}
              label={t.plain("countCheck")}
              tone="text-amber-600 dark:text-amber-400"
            />
            <Count
              value={counts.none}
              label={t.plain("countNone")}
              tone="text-muted-foreground"
            />
          </div>
        )}

        {counts && counts.unchecked > 0 && (
          <p className="text-muted-foreground text-xs">
            {t.plain("unchecked", { count: counts.unchecked })}
          </p>
        )}
        {counts && counts.error > 0 && (
          <p className="text-muted-foreground text-xs">
            {t.plain("failedNote", { count: counts.error })}
          </p>
        )}
        <p className="text-muted-foreground text-xs">{t("notFoundNote")}</p>

        <div>
          <Button
            variant="outline"
            className="rounded-full"
            nativeButton={false}
            render={<V3Link href="/identify">{t("reviewLink")}</V3Link>}
          />
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
