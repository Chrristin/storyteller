"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@v3/_/components/ui/button"
import { Spinner } from "@v3/_/components/ui/spinner"
import { useTranslation } from "@v3/_/hooks/use-translation"

import {
  useApplyTitleCleanupMutation,
  useGetTitleCleanupPreviewQuery,
  useUndoTitleCleanupMutation,
} from "@/store/api"

import { ConfirmButton } from "./maintenance-helpers"
import { SettingsCard, SettingsSection } from "./shared"

const PAGE_SIZE = 50

/**
 * Preview and apply for the title clean-up. Nothing runs by itself: the list
 * is only loaded after Preview, and nothing changes until Apply is confirmed.
 */
export function TitleCleanupSection() {
  const t = useTranslation("SettingsPage.tabs.metadata.sections.titleCleanup")
  const [previewing, setPreviewing] = useState(false)
  const [offset, setOffset] = useState(0)

  // Before Preview, limit 0 only asks for the last clean-up (for the Undo
  // button) and does not scan the library.
  const {
    data: summary,
    currentData,
    isFetching,
    refetch,
  } = useGetTitleCleanupPreviewQuery({
    offset,
    limit: previewing ? PAGE_SIZE : 0,
  })
  const data = previewing ? currentData : undefined
  const [apply, { isLoading: isApplying }] = useApplyTitleCleanupMutation()
  const [undo, { isLoading: isUndoing }] = useUndoTitleCleanupMutation()

  const total = data?.total ?? 0
  const lastBatch = (currentData ?? summary)?.lastBatch ?? null

  const runApply = async () => {
    try {
      const result = await apply().unwrap()
      toast.success(
        t.plain("applied", { applied: result.applied }) +
          (result.skipped > 0
            ? t.plain("appliedSkipped", { skipped: result.skipped })
            : "") +
          (result.errors.length > 0
            ? t.plain("appliedErrors", { errors: result.errors.length })
            : ""),
      )
      setOffset(0)
    } catch {
      toast.error(t.plain("applyFailed"))
    }
  }

  const runUndo = async () => {
    try {
      const result = await undo().unwrap()
      toast.success(
        t.plain("undone", { restored: result.restored }) +
          (result.skipped > 0
            ? t.plain("undoSkipped", { skipped: result.skipped })
            : ""),
      )
    } catch {
      toast.error(t.plain("undoFailed"))
    }
  }

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(total, offset + PAGE_SIZE)

  return (
    <SettingsSection id="titleCleanup">
      <SettingsCard title={t("title")} description={t("description")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="rounded-full"
            disabled={isFetching || isApplying}
            onClick={() => {
              if (previewing) {
                setOffset(0)
                void refetch()
                return
              }
              setPreviewing(true)
            }}
          >
            {isFetching && previewing && <Spinner className="size-3.5" />}
            {previewing ? t("refresh") : t("preview")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            title={t.plain("undoTip")}
            disabled={!lastBatch || isUndoing || isApplying}
            onClick={() => {
              void runUndo()
            }}
          >
            {isUndoing && <Spinner className="size-3.5" />}
            {t("undo")}
          </Button>
        </div>

        {lastBatch && (
          <p className="text-muted-foreground text-xs">
            {t.plain("undoNote", { count: lastBatch.count })}
          </p>
        )}

        {previewing && data && (
          <div className="space-y-3">
            {total === 0 ? (
              <p className="text-sm">{t("nothing")}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {t.plain("total", { count: total })}
                  </p>
                  <ConfirmButton
                    label={t.plain("applyAll", { count: total })}
                    isLoading={isApplying}
                    disabled={isApplying}
                    title={t.plain("confirmTitle", { count: total })}
                    description={t.plain("confirmBody")}
                    confirmLabel={t.plain("confirmApply")}
                    onConfirm={runApply}
                  />
                </div>

                <ul className="divide-y rounded-lg border text-sm">
                  {data.items.map((item) => (
                    <li key={item.bookUuid} className="space-y-0.5 px-3 py-2">
                      <div className="text-muted-foreground break-words line-through">
                        {item.oldTitle}
                      </div>
                      <div className="font-medium break-words">
                        {"→ "}
                        {item.newTitle}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {item.reason}
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground text-xs">
                    {t.plain("page", { from, to, total })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={offset === 0 || isFetching}
                      onClick={() => {
                        setOffset(Math.max(0, offset - PAGE_SIZE))
                      }}
                    >
                      {t("previous")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={offset + PAGE_SIZE >= total || isFetching}
                      onClick={() => {
                        setOffset(offset + PAGE_SIZE)
                      }}
                    >
                      {t("next")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SettingsCard>
    </SettingsSection>
  )
}
