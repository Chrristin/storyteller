"use client"

import { useMemo } from "react"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"

import { Tile } from "./Cover"
import { useCoverColorsEnabled } from "./CoverScope"
import { type BookCoverImage, imageAspect } from "./coverFit"
import { coverSwatches } from "./coverSwatches"
import { WAVE_VIEWBOX, type Rgb, generateWaves } from "./coverWaves"

const NEUTRAL: Rgb = { r: 110, g: 110, b: 110 }

const MIN_SQUARE_ASPECT = 0.85

// A square audiobook cover is shown at the top of the tall card and the
// leftover space is filled with waves. Anything clearly taller keeps the
// normal fill logic.
export function usesWaveCover(image: BookCoverImage | null | undefined) {
  const aspect = imageAspect(image)
  return aspect !== null && aspect >= MIN_SQUARE_ASPECT
}

export function WaveCover({
  book,
  image,
  width,
  showMeta = false,
  className,
}: {
  book: BookWithRelations
  image: BookCoverImage
  width: number
  /** Draw the author and title over the waves at the bottom of the card. */
  showMeta?: boolean
  className?: string
}) {
  const colorsEnabled = useCoverColorsEnabled()
  const colors = book.coverColorsOverride ?? image.colors
  const main = useMemo<Rgb>(() => {
    if (!colorsEnabled) return NEUTRAL
    const swatches = coverSwatches(colors ?? [])
    return swatches.hasColors ? swatches.primary.rgb : NEUTRAL
  }, [colorsEnabled, colors])

  const fill = useMemo(() => generateWaves(book.uuid, main), [book.uuid, main])
  const authors = book.authors.map((a) => a.name).join(", ")
  const aspect = Math.min(imageAspect(image) ?? 1, 5 / 4)

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{ background: fill.background }}
    >
      <svg
        aria-hidden
        className="absolute bottom-0 left-0 w-full"
        style={{
          aspectRatio: `${WAVE_VIEWBOX.width} / ${WAVE_VIEWBOX.height}`,
        }}
        viewBox={`0 0 ${WAVE_VIEWBOX.width} ${WAVE_VIEWBOX.height}`}
        preserveAspectRatio="none"
      >
        {fill.layers.map((layer, i) => (
          <path key={i} d={layer.path} fill={layer.fill} />
        ))}
      </svg>
      <div className="relative w-full" style={{ aspectRatio: `${aspect}` }}>
        <Tile
          image={image}
          size={Math.round(width)}
          alt={book.title}
          type="audiobook"
          fit="cover"
          className="h-full w-full rounded-none"
        />
      </div>
      {showMeta && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-w-0 flex-col gap-0.5 bg-linear-to-b from-transparent to-black/55 pt-6 pr-7 pb-2.5 pl-2.5 text-white">
          {authors && (
            <p className="line-clamp-1 text-xs text-white/80">{authors}</p>
          )}
          <p
            lang={book.language ?? undefined}
            className="line-clamp-2 text-sm leading-tight font-medium"
          >
            {book.title}
          </p>
        </div>
      )}
    </div>
  )
}
