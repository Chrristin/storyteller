"use client"

import { Cover } from "@v3/_/components/books/Cover"
import { V3Link } from "@v3/_/components/v3-link"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import { type Pile } from "@/piles"

// Position and lean of each cover in the stack: the front one is almost
// straight, the two behind lean out to either side.
const FRONT = { left: "21%", top: "3%", rotate: -1.5 }
const BACK_LEFT = { left: "4%", top: "9%", rotate: -8 }
const BACK_RIGHT = { left: "38%", top: "6%", rotate: 7 }

export function PilesStack({ pile }: { pile: Pile<BookWithRelations> }) {
  const t = useTranslation("PilesPage")
  const href =
    pile.kind === "series"
      ? `/series?item=${pile.uuid}`
      : `/authors?item=${pile.uuid}`

  // Paint the back covers first so the front one sits on top.
  const layers = [
    pile.covers[2] && { book: pile.covers[2], ...BACK_RIGHT },
    pile.covers[1] && { book: pile.covers[1], ...BACK_LEFT },
    pile.covers[0] && { book: pile.covers[0], ...FRONT },
  ].filter((layer) => !!layer)

  return (
    <V3Link
      href={href}
      className="group/pile focus-visible:ring-ring/50 block min-w-0 rounded-md outline-none focus-visible:ring-[3px]"
    >
      <div className="relative w-full" style={{ aspectRatio: "1 / 1.05" }}>
        {layers.map((layer, i) => (
          <div
            key={layer.book.uuid}
            className={cn(
              "absolute w-[58%] transition-transform duration-200",
              i === layers.length - 1 && "group-hover/pile:-translate-y-0.5",
            )}
            style={{
              left: layer.left,
              top: layer.top,
              aspectRatio: "2 / 3",
              transform: `rotate(${layer.rotate}deg)`,
            }}
          >
            <Cover book={layer.book} fill interactive={false} />
          </div>
        ))}
      </div>
      <div className="mt-2 truncate text-sm font-medium">{pile.name}</div>
      <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
        <span>{t("bookCount", { count: pile.count })}</span>
        {pile.missing > 0 && (
          <>
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full bg-amber-500"
            />
            <span className="text-amber-600 dark:text-amber-400">
              {t("missingCount", { count: pile.missing })}
            </span>
          </>
        )}
      </div>
    </V3Link>
  )
}
