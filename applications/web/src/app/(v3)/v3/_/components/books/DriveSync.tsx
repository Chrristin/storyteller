"use client"

import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import { Spinner } from "@v3/_/components/ui/spinner"
import { useVersionBasePath } from "@v3/_/components/version-context"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { downloadableAsset } from "@/bookDownloads"
import { type BookWithRelations } from "@/database/books"
import {
  DRIVE_BATCH_SIZE,
  type DriveSyncTally,
  addBatchToTally,
  addFailedBatchToTally,
  chunk,
  emptyTally,
} from "@/driveSync"
import { usePermission } from "@/hooks/usePermission"
import * as icon from "@/icons"
import {
  useGetDriveBooksQuery,
  useGetDriveStatusQuery,
  useSyncBooksToDriveMutation,
} from "@/store/api"

type DriveBook = Pick<BookWithRelations, "uuid" | "title" | "ebook">

type DriveErrorData = { code?: string; message?: string }

export function hasDriveEbook(book: Pick<BookWithRelations, "ebook">) {
  return !!downloadableAsset(book, "ebook")
}

/** True when the signed-in user may sync and the owner has connected Drive. */
export function useDriveConnected(enabled = true) {
  const canDownload = usePermission("bookDownload")
  const { data } = useGetDriveStatusQuery(undefined, {
    skip: !enabled || !canDownload,
  })
  return !!canDownload && !!data?.connected
}

function useDriveErrorMessage() {
  const t = useTranslation("Sharing.drive")

  return useCallback(
    (error: unknown) => {
      const data = (error as { data?: DriveErrorData } | undefined)?.data
      switch (data?.code) {
        case "reauth-needed":
          return t.plain("reauthNeeded")
        case "kobo-folder-missing":
          return t.plain("koboFolderMissing")
        case "kobo-folder-ambiguous":
          return t.plain("koboFolderAmbiguous")
        default:
          return data?.message
      }
    },
    [t],
  )
}

export function SyncToDriveButton({ book }: { book: DriveBook }) {
  const t = useTranslation("Sharing.drive")
  const router = useRouter()
  const basePath = useVersionBasePath()
  const canConfigure = usePermission("settingsUpdate")
  const hasEbook = hasDriveEbook(book)
  const connected = useDriveConnected(hasEbook)
  const errorMessage = useDriveErrorMessage()
  const [sync, { isLoading }] = useSyncBooksToDriveMutation()
  const { data: files } = useGetDriveBooksQuery([book.uuid], {
    skip: !connected || !hasEbook,
  })
  const onDrive = !!files?.[book.uuid]

  const run = useCallback(
    async (overwrite: boolean) => {
      try {
        const result = await sync({ books: [book.uuid], overwrite }).unwrap()
        const failure = result.results.find(
          (entry) => entry.status === "failed",
        )
        if (failure) {
          toast.error(t.plain("failedToast"), { description: failure.message })
        } else if (result.replaced > 0) {
          toast.success(t.plain("replacedToast"))
        } else if (result.skipped > 0) {
          toast.success(t.plain("skippedToast"))
        } else {
          toast.success(t.plain("syncedToast"))
        }
      } catch (error) {
        const code = (error as { data?: DriveErrorData }).data?.code
        toast.error(t.plain("failedToast"), {
          description: errorMessage(error),
          action:
            code === "reauth-needed" && canConfigure
              ? {
                  label: t.plain("openSettings"),
                  onClick: () => {
                    router.push(
                      `${basePath}/settings?tab=server&section=googleDrive`,
                    )
                  },
                }
              : undefined,
        })
      }
    },
    [sync, book.uuid, t, errorMessage, canConfigure, router, basePath],
  )

  if (!hasEbook || !connected) return null

  if (isLoading) {
    return (
      <Button
        variant="cover"
        size="sm"
        className="rounded-full"
        disabled
        aria-busy
      >
        <Spinner className="size-3.5" />
        {t("syncing")}
      </Button>
    )
  }

  if (onDrive) {
    return (
      <div className="flex items-center gap-1">
        <span className="bg-cover-accent/15 text-cover-accent inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium">
          <icon.Check className="size-3.5" />
          {t("onDrive")}
        </span>
        <Button
          variant="real-ghost"
          size="xs"
          className="text-muted-foreground rounded-full underline underline-offset-2"
          onClick={() => {
            void run(true)
          }}
        >
          {t("replaceFile")}
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="cover"
      size="sm"
      className="rounded-full"
      onClick={() => {
        void run(false)
      }}
    >
      <icon.Upload className="size-4" />
      {t("sync")}
    </Button>
  )
}

type Phase = "idle" | "running" | "done"

/** Sends the selected books' ebooks in sequential batches and reports progress. */
export function useBulkDriveSync(books: DriveBook[], enabled: boolean) {
  const connected = useDriveConnected(enabled)
  const errorMessage = useDriveErrorMessage()
  const [sync] = useSyncBooksToDriveMutation()
  const [open, setOpen] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [tally, setTally] = useState<DriveSyncTally>(emptyTally)
  const [stopReason, setStopReason] = useState<string | null>(null)
  const cancelled = useRef(false)

  const syncable = books.filter(hasDriveEbook)
  const available = enabled && connected && syncable.length > 0

  const start = useCallback(async () => {
    const targets = syncable
    cancelled.current = false
    setPhase("running")
    setStopReason(null)
    setProgress({ done: 0, total: targets.length })
    let current = emptyTally()
    setTally(current)

    let done = 0
    for (const batch of chunk(targets, DRIVE_BATCH_SIZE)) {
      if (cancelled.current) break
      try {
        const response = await sync({
          books: batch.map((book) => book.uuid),
          overwrite,
        }).unwrap()
        current = addBatchToTally(current, response)
      } catch (error) {
        // A Drive-wide problem (sign-in, folder) would fail every batch, so
        // stop here and count this batch as failed.
        const message = errorMessage(error) ?? "Request failed"
        current = addFailedBatchToTally(current, batch, message)
        setTally(current)
        setStopReason(message)
        break
      }
      done += batch.length
      setProgress({ done, total: targets.length })
      setTally(current)
    }
    setPhase("done")
  }, [syncable, sync, overwrite, errorMessage])

  const openDialog = useCallback(() => {
    setPhase("idle")
    setTally(emptyTally())
    setStopReason(null)
    setOpen(true)
  }, [])

  const dialog = (
    <BulkDriveSyncDialog
      open={open}
      count={syncable.length}
      overwrite={overwrite}
      onOverwriteChange={setOverwrite}
      phase={phase}
      progress={progress}
      tally={tally}
      stopReason={stopReason}
      onStart={() => {
        void start()
      }}
      onStop={() => {
        cancelled.current = true
      }}
      onOpenChange={(next) => {
        if (!next && phase === "running") return
        setOpen(next)
      }}
    />
  )

  return { available, count: syncable.length, openDialog, dialog }
}

function BulkDriveSyncDialog({
  open,
  count,
  overwrite,
  onOverwriteChange,
  phase,
  progress,
  tally,
  stopReason,
  onStart,
  onStop,
  onOpenChange,
}: {
  open: boolean
  count: number
  overwrite: boolean
  onOverwriteChange: (value: boolean) => void
  phase: Phase
  progress: { done: number; total: number }
  tally: DriveSyncTally
  stopReason: string | null
  onStart: () => void
  onStop: () => void
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslation("Sharing.drive")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bulkTitle")}</DialogTitle>
          <DialogDescription>
            {t("bulkDescription", { count })}
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={overwrite}
              onCheckedChange={(checked) => {
                onOverwriteChange(checked)
              }}
            />
            {t("replaceExisting")}
          </label>
        )}

        {phase === "running" && (
          <div className="space-y-2" role="status">
            <p className="flex items-center gap-2 text-sm">
              <Spinner className="size-3.5" />
              {t("progress", {
                done: progress.done,
                total: progress.total,
              })}
            </p>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-2 text-sm" role="status">
            <p>
              {t("summary", {
                sent: tally.sent,
                skipped: tally.skipped,
                failed: tally.failed,
              })}
              {tally.replaced > 0 && (
                <>
                  {" "}
                  <span className="text-muted-foreground">
                    ({t("summaryReplaced", { replaced: tally.replaced })})
                  </span>
                </>
              )}
            </p>
            {stopReason && (
              <p className="text-destructive text-xs">
                {t("stopped", { message: stopReason })}
              </p>
            )}
            {tally.failures.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">{t("failuresTitle")}</p>
                <ul className="border-border max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                  {tally.failures.map((failure) => (
                    <li key={failure.uuid}>
                      <span className="font-medium">{failure.title}</span>
                      {failure.message && (
                        <span className="text-muted-foreground">
                          {" "}
                          {failure.message}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === "idle" && (
            <Button className="rounded-full" onClick={onStart}>
              <icon.Upload className="size-3.5" />
              {t("start")}
            </Button>
          )}
          {phase === "running" && (
            <Button variant="outline" className="rounded-full" onClick={onStop}>
              {t("stop")}
            </Button>
          )}
          {phase === "done" && (
            <Button
              className="rounded-full"
              onClick={() => {
                onOpenChange(false)
              }}
            >
              {t("close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
