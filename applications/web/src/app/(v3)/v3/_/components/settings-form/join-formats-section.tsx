"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@v3/_/components/ui/button"
import { ConfirmDialog } from "@v3/_/components/ui/confirm-dialog"
import { Spinner } from "@v3/_/components/ui/spinner"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type LinkRunResult } from "@/bookLinker"
import {
  useGenerateMissingCoversMutation,
  usePreviewBookLinksMutation,
  useRunBookLinksMutation,
} from "@/store/api"

import { SettingsCard, SettingsSection } from "./shared"

function serverMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: unknown }).data
    if (typeof data === "string") return data
    if (typeof data === "object" && data !== null) {
      const { error: e, message } = data as {
        error?: unknown
        message?: unknown
      }
      if (typeof e === "string") return e
      if (typeof message === "string") return message
    }
  }
  if (typeof error === "object" && error !== null && "error" in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === "string") return e
  }
  return ""
}

/**
 * Preview and run for joining ebook-only and audiobook-only books. Nothing
 * loads or runs by itself: the dry run starts with Preview, and joining needs
 * a confirmed click after a preview that found something.
 */
export function JoinFormatsSection() {
  const t = useTranslation("SettingsPage.tabs.maintenance.sections.joinFormats")
  const [preview, { isLoading: isPreviewing }] = usePreviewBookLinksMutation()
  const [run, { isLoading: isRunning }] = useRunBookLinksMutation()
  const [plan, setPlan] = useState<LinkRunResult | null>(null)
  const [result, setResult] = useState<LinkRunResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const runPreview = async () => {
    setResult(null)
    try {
      setPlan(await preview().unwrap())
    } catch (error) {
      setPlan(null)
      toast.error(t.plain("previewFailed", { message: serverMessage(error) }))
    }
  }

  const runJoin = async () => {
    try {
      setResult(await run().unwrap())
      setPlan(null)
    } catch (error) {
      toast.error(t.plain("failed", { message: serverMessage(error) }))
    }
  }

  const pairCount = plan?.pairs.length ?? 0
  const joined = result?.pairs.filter((pair) => pair.merged).length ?? 0
  const errors = result?.pairs.filter((pair) => pair.error) ?? []

  return (
    <SettingsSection id="joinFormats">
      <SettingsCard title={t("title")} description={t("description")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="rounded-full"
            disabled={isPreviewing || isRunning}
            onClick={() => {
              void runPreview()
            }}
          >
            {isPreviewing && <Spinner className="size-3.5" />}
            {plan ? t("refresh") : t("preview")}
          </Button>
          {plan && pairCount > 0 && (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={isRunning || isPreviewing}
              onClick={() => {
                setConfirmOpen(true)
              }}
            >
              {isRunning && <Spinner className="size-3.5" />}
              {t.plain("join", { count: pairCount })}
            </Button>
          )}
        </div>

        {plan && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {t.plain("summary", {
                considered: plan.considered,
                pairs: pairCount,
                unclear: plan.ambiguous.length,
              })}
            </p>
            {pairCount === 0 && plan.ambiguous.length === 0 && (
              <p className="text-sm">{t("nothing")}</p>
            )}
            {pairCount > 0 && (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  {t("pairsTitle")}
                </p>
                <ul className="divide-y rounded-lg border text-sm">
                  {plan.pairs.map((pair) => (
                    <li
                      key={`${pair.ebook}\u0000${pair.audiobook}`}
                      className="space-y-0.5 px-3 py-2"
                    >
                      <div className="break-words">
                        {t.plain("pair", {
                          ebook: pair.ebook,
                          audiobook: pair.audiobook,
                        })}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {t.plain(`reason.${pair.reason}`)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.ambiguous.length > 0 && (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  {t("unclearTitle")}
                </p>
                <ul className="divide-y rounded-lg border text-sm">
                  {plan.ambiguous.map((match) => (
                    <li
                      key={`${match.title}\u0000${match.candidates.join("|")}`}
                      className="px-3 py-2 break-words"
                    >
                      {t.plain("unclear", {
                        title: match.title,
                        candidates: match.candidates.join(", "),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t.plain("joined", { count: joined })}
            </p>
            {errors.length > 0 && (
              <ul className="text-destructive space-y-1 text-sm">
                {errors.map((pair) => (
                  <li
                    key={`${pair.ebook}\u0000${pair.audiobook}`}
                    className="break-words"
                  >
                    {t.plain("pairError", {
                      ebook: pair.ebook,
                      audiobook: pair.audiobook,
                      error: pair.error ?? "",
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SettingsCard>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.plain("confirmTitle", { count: pairCount })}
        description={t.plain("confirmBody")}
        confirmLabel={t.plain("confirmJoin")}
        variant="destructive"
        isLoading={isRunning}
        onConfirm={runJoin}
      />
    </SettingsSection>
  )
}

/** Draws title covers for books that have none. Manual, behind a confirm. */
export function DrawCoversSection() {
  const t = useTranslation("SettingsPage.tabs.maintenance.sections.drawCovers")
  const [generate, { isLoading }] = useGenerateMissingCoversMutation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [outcome, setOutcome] = useState<{
    generated: number
    skipped: number
  } | null>(null)

  const runDraw = async () => {
    try {
      const { generated, skipped } = await generate().unwrap()
      setOutcome({ generated, skipped })
    } catch (error) {
      setOutcome(null)
      toast.error(t.plain("failed", { message: serverMessage(error) }))
    }
  }

  return (
    <SettingsSection id="drawCovers">
      <SettingsCard title={t("title")} description={t("description")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="rounded-full"
            disabled={isLoading}
            onClick={() => {
              setConfirmOpen(true)
            }}
          >
            {isLoading && <Spinner className="size-3.5" />}
            {t("draw")}
          </Button>
        </div>
        {outcome && (
          <p className="text-sm font-medium">{t.plain("result", outcome)}</p>
        )}
      </SettingsCard>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.plain("confirmTitle")}
        description={t.plain("confirmBody")}
        confirmLabel={t.plain("confirmDraw")}
        isLoading={isLoading}
        onConfirm={runDraw}
      />
    </SettingsSection>
  )
}
