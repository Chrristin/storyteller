"use client"

import { type ReactNode } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import { Spinner } from "@v3/_/components/ui/spinner"

import { type DriveSyncTally } from "@/driveSync"
import * as icon from "@/icons"

export type BulkPhase = "idle" | "running" | "done"

/**
 * Shared shell of the bulk Sync to Drive and bulk Send to Kindle dialogs: an
 * options step, batch progress, a summary with failures, and a stop button.
 */
export function BulkSendDialog({
  open,
  title,
  description,
  idleContent,
  phase,
  progress,
  progressLabel,
  summary,
  failuresTitle,
  stopReason,
  startLabel,
  stopLabel,
  closeLabel,
  startDisabled,
  onStart,
  onStop,
  onOpenChange,
  tally,
}: {
  open: boolean
  title: ReactNode
  description: ReactNode
  idleContent?: ReactNode
  phase: BulkPhase
  progress: { done: number; total: number }
  progressLabel: ReactNode
  summary: ReactNode
  failuresTitle: ReactNode
  stopReason: ReactNode
  startLabel: ReactNode
  stopLabel: ReactNode
  closeLabel: ReactNode
  startDisabled?: boolean
  tally: DriveSyncTally
  onStart: () => void
  onStop: () => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {phase === "idle" && idleContent}

        {phase === "running" && (
          <div className="space-y-2" role="status">
            <p className="flex items-center gap-2 text-sm">
              <Spinner className="size-3.5" />
              {progressLabel}
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
            <p>{summary}</p>
            {stopReason && (
              <p className="text-destructive text-xs">{stopReason}</p>
            )}
            {tally.failures.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">{failuresTitle}</p>
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
            <Button
              className="rounded-full"
              disabled={startDisabled}
              onClick={onStart}
            >
              <icon.Upload className="size-3.5" />
              {startLabel}
            </Button>
          )}
          {phase === "running" && (
            <Button variant="outline" className="rounded-full" onClick={onStop}>
              {stopLabel}
            </Button>
          )}
          {phase === "done" && (
            <Button
              className="rounded-full"
              onClick={() => {
                onOpenChange(false)
              }}
            >
              {closeLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
