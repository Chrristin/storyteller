import { useTranslation } from "@v3/_/hooks/use-translation"

/** A dashed amber stand-in for a series number the library does not have. */
export function GapPlaceholder({ position }: { position: number }) {
  const t = useTranslation("BookList")
  return (
    <div
      role="img"
      aria-label={`#${position} ${t.plain("missingBook")}`}
      className="flex aspect-13/16 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-amber-500/70 text-amber-600 dark:text-amber-400"
    >
      <span className="text-lg font-semibold">#{position}</span>
      <span className="text-xs">{t("missingBook")}</span>
    </div>
  )
}
