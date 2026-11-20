"use client"

import { useMemo, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import { Spinner } from "@v3/_/components/ui/spinner"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import { type DuplicateBook, type DuplicatePreview } from "@/duplicates"
import {
  useArchiveDuplicatesMutation,
  useFindDuplicatesMutation,
} from "@/store/api"
import { formatBytes } from "@/strings"

import { ConfirmButton, runWithToast } from "./maintenance-helpers"
import { SettingsCard, SettingsSection } from "./shared"

function bookDetail(book: DuplicateBook, format: "ebook" | "audiobook") {
  const size = format === "ebook" ? book.ebookSize : book.audiobookSize
  const path = format === "ebook" ? book.ebookPath : book.audiobookPath
  return [size ? formatBytes(size) : null, path].filter(Boolean).join(" · ")
}

/**
 * Finds books that are the same title and author in the same format, and moves
 * the ones you do not want to the Archive. Nothing runs by itself, nothing is
 * deleted and no file is touched.
 */
export function FindDuplicatesSection() {
  const t = useTranslation("SettingsPage.tabs.maintenance.sections.duplicates")
  const [find, { isLoading: isFinding }] = useFindDuplicatesMutation()
  const [archive, { isLoading: isArchiving }] = useArchiveDuplicatesMutation()
  const [preview, setPreview] = useState<DuplicatePreview | null>(null)
  const [keepers, setKeepers] = useState<Record<string, string>>({})
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [archived, setArchived] = useState<number | null>(null)

  const runFind = async () => {
    setArchived(null)
    const found = await runWithToast(
      () => find().unwrap(),
      (message) => t.plain("failed", { message }),
    )
    setPreview(found ?? null)
    if (!found) return
    setKeepers(
      Object.fromEntries(found.groups.map((g) => [g.key, g.keeperUuid])),
    )
    setSkipped(new Set())
  }

  const chosen = useMemo(() => {
    const requests: { keeperUuid: string; archiveUuids: string[] }[] = []
    const uuids = new Set<string>()
    for (const group of preview?.groups ?? []) {
      if (skipped.has(group.key)) continue
      const keeper = keepers[group.key] ?? group.keeperUuid
      const archiveUuids = group.books
        .map((b) => b.uuid)
        .filter((uuid) => uuid !== keeper)
      for (const uuid of archiveUuids) uuids.add(uuid)
      requests.push({ keeperUuid: keeper, archiveUuids })
    }
    return { requests, count: uuids.size }
  }, [preview, keepers, skipped])

  const runArchive = async () => {
    const result = await runWithToast(
      () => archive({ groups: chosen.requests }).unwrap(),
      (message) => t.plain("archiveFailed", { message }),
    )
    if (!result) return
    setArchived(result.archived)
    setPreview(null)
  }

  return (
    <SettingsSection id="findDuplicates">
      <SettingsCard title={t("title")} description={t("description")}>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="rounded-full"
            disabled={isFinding || isArchiving}
            onClick={() => {
              void runFind()
            }}
          >
            {isFinding && <Spinner className="size-3.5" />}
            {t("find")}
          </Button>
          {preview && (
            <span className="text-muted-foreground text-sm">
              {t.plain("summary", {
                groups: preview.totalGroups,
                books: preview.booksToArchive,
              })}
            </span>
          )}
        </div>

        {preview && preview.totalGroups === 0 && (
          <p className="text-sm">{t("nothing")}</p>
        )}

        {preview && preview.groups.length > 0 && (
          <div className="space-y-3">
            {preview.totalGroups > preview.groups.length && (
              <p className="text-muted-foreground text-xs">
                {t.plain("partial", { shown: preview.groups.length })}
              </p>
            )}
            {preview.groups.map((group) => {
              const keeper = keepers[group.key] ?? group.keeperUuid
              const isSkipped = skipped.has(group.key)
              return (
                <div
                  key={group.key}
                  className={cn(
                    "space-y-2 rounded-xl border p-3",
                    isSkipped && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold break-words">
                      {group.name}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        setSkipped((prev) => {
                          const next = new Set(prev)
                          if (next.has(group.key)) next.delete(group.key)
                          else next.add(group.key)
                          return next
                        })
                      }}
                    >
                      {isSkipped ? t("unskip") : t("skip")}
                    </Button>
                  </div>
                  <div role="radiogroup" aria-label={group.name}>
                    {group.books.map((book) => {
                      const isKeeper = book.uuid === keeper
                      return (
                        <label
                          key={book.uuid}
                          className={cn(
                            "mb-2 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2",
                            isKeeper && !isSkipped && "border-primary",
                          )}
                        >
                          <input
                            type="radio"
                            name={group.key}
                            checked={isKeeper}
                            disabled={isSkipped}
                            onChange={() => {
                              setKeepers((prev) => ({
                                ...prev,
                                [group.key]: book.uuid,
                              }))
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium break-words">
                              {book.title}
                            </span>
                            <span className="text-muted-foreground block text-xs break-all">
                              {bookDetail(book, group.format)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              isKeeper && !isSkipped
                                ? "text-green-600"
                                : "text-muted-foreground",
                            )}
                          >
                            {isSkipped
                              ? ""
                              : isKeeper
                                ? t("keep")
                                : t("archive")}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmButton
                label={t.plain("archiveButton", { count: chosen.count })}
                isLoading={isArchiving}
                disabled={chosen.count === 0 || isArchiving}
                title={t.plain("confirmTitle", { count: chosen.count })}
                description={t.plain("confirmBody")}
                confirmLabel={t.plain("confirmArchive")}
                onConfirm={runArchive}
              />
            </div>
            <p className="text-muted-foreground text-xs">{t("hint")}</p>
          </div>
        )}

        {archived !== null && (
          <p className="text-sm font-medium">
            {t.plain("result", { count: archived })}
          </p>
        )}
      </SettingsCard>
    </SettingsSection>
  )
}
