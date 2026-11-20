/**
 * Draws a cover from a title and an author, for ebooks and read-alouds that
 * have no cover at all. Pure and deterministic: the same title and author
 * always give the same bytes, so the sha256 is stable and identical covers
 * share one image row.
 *
 * Text is rendered by sharp's librsvg, which looks fonts up through fontconfig,
 * so the server container needs at least one font (the Dockerfile installs
 * DejaVu). If the probe below finds that no text can be drawn, the cover is
 * drawn without text rather than with empty boxes.
 */
import { logger } from "@/logging"

import { getSharp } from "./derive"

export const GENERATED_COVER_WIDTH = 600
export const GENERATED_COVER_HEIGHT = 900

const MAX_CHARS_PER_LINE = 12
const MAX_LINES = 5
const FONT_FAMILY = "DejaVu Serif, Georgia, serif"

export const COVER_PALETTE: readonly (readonly [string, string])[] = [
  ["#1b3a4b", "#f2c14e"],
  ["#3a1c2f", "#e8a0bf"],
  ["#26402e", "#f4e9cd"],
  ["#4a2c14", "#f0c987"],
  ["#222a54", "#c6d0ff"],
  ["#4a1e1e", "#f6c7a8"],
]

export function normalizeTitle(title: string): string {
  return title.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
}

/** FNV-1a, 32 bit, over the utf-8 bytes of the string. */
export function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    // 1664525 * state stays below 2^53, so plain arithmetic is exact
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ")
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** wraps by words, hard-breaking long words, at most MAX_LINES lines */
export function wrapTitle(
  title: string,
  maxChars = MAX_CHARS_PER_LINE,
  maxLines = MAX_LINES,
): string[] {
  const words = clean(title).trim().split(" ").filter(Boolean)
  const lines: string[] = []
  let current = ""

  const push = () => {
    if (current) lines.push(current)
    current = ""
  }

  for (const word of words) {
    const chars = Array.from(word)
    if (chars.length > maxChars) {
      push()
      for (let i = 0; i < chars.length; i += maxChars) {
        const chunk = chars.slice(i, i + maxChars).join("")
        if (i + maxChars < chars.length) lines.push(chunk)
        else current = chunk
      }
      continue
    }
    const candidate = current ? `${current} ${word}` : word
    if (Array.from(candidate).length <= maxChars) {
      current = candidate
    } else {
      push()
      current = word
    }
  }
  push()

  if (lines.length <= maxLines) return lines

  const kept = lines.slice(0, maxLines)
  const last = Array.from(kept[maxLines - 1] ?? "")
  kept[maxLines - 1] =
    last
      .slice(0, Math.max(maxChars - 1, 1))
      .join("")
      .trimEnd() + "…"
  return kept
}

function titleFontSize(lines: string[]): number {
  const longest = Math.max(...lines.map((line) => Array.from(line).length), 1)
  // a bold serif glyph is about 0.68em wide on average; keep 500px of 600
  return Math.max(36, Math.min(76, Math.floor(500 / (longest * 0.68))))
}

function authorLine(author: string | null | undefined): string | null {
  const text = clean(author ?? "")
    .trim()
    .toUpperCase()
  if (!text) return null
  const chars = Array.from(text)
  return chars.length > 26 ? chars.slice(0, 25).join("").trimEnd() + "…" : text
}

function shapes(seed: number, color: string): string {
  const next = lcg(seed)
  const out: string[] = []
  for (let i = 0; i < 5; i++) {
    const kind = Math.floor(next() * 3)
    const cx = Math.round(next() * GENERATED_COVER_WIDTH)
    const cy = Math.round(next() * GENERATED_COVER_HEIGHT * 0.65)
    const size = Math.round(90 + next() * 170)
    const opacity = (0.1 + next() * 0.12).toFixed(3)
    const rotation = Math.round(next() * 90)
    const attrs = `fill="${color}" fill-opacity="${opacity}"`
    if (kind === 0) {
      out.push(
        `<circle cx="${cx}" cy="${cy}" r="${Math.round(size / 2)}" ${attrs}/>`,
      )
    } else if (kind === 1) {
      out.push(
        `<rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" transform="rotate(${rotation} ${cx} ${cy})" ${attrs}/>`,
      )
    } else {
      const h = Math.round(size * 0.87)
      const points = `${cx},${cy - h / 2} ${cx + size / 2},${cy + h / 2} ${cx - size / 2},${cy + h / 2}`
      out.push(
        `<polygon points="${points}" transform="rotate(${rotation} ${cx} ${cy})" ${attrs}/>`,
      )
    }
  }
  return out.join("")
}

export function buildCoverSvg(
  title: string,
  author?: string | null,
  options: { text?: boolean } = {},
): string {
  const withText = options.text ?? true
  const shownTitle = clean(title).trim() || "Untitled"
  const seed = fnv1a(normalizeTitle(shownTitle))
  const [background, foreground] =
    COVER_PALETTE[seed % COVER_PALETTE.length] ?? COVER_PALETTE[0]!

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${GENERATED_COVER_WIDTH}" height="${GENERATED_COVER_HEIGHT}" viewBox="0 0 ${GENERATED_COVER_WIDTH} ${GENERATED_COVER_HEIGHT}">`,
    `<rect width="${GENERATED_COVER_WIDTH}" height="${GENERATED_COVER_HEIGHT}" fill="${background}"/>`,
    shapes(seed, foreground),
  ]

  if (withText) {
    const lines = wrapTitle(shownTitle)
    const size = titleFontSize(lines)
    const lineHeight = Math.round(size * 1.2)
    const blockBottom = 690
    const firstBaseline = blockBottom - (lines.length - 1) * lineHeight
    const tspans = lines
      .map(
        (line, i) =>
          `<tspan x="${GENERATED_COVER_WIDTH / 2}" y="${firstBaseline + i * lineHeight}">${escapeXml(line)}</tspan>`,
      )
      .join("")
    parts.push(
      `<text text-anchor="middle" font-family="${FONT_FAMILY}" font-weight="bold" font-size="${size}" fill="${foreground}">${tspans}</text>`,
      `<rect x="${GENERATED_COVER_WIDTH / 2 - 40}" y="728" width="80" height="3" fill="${foreground}" fill-opacity="0.8"/>`,
    )
    const name = authorLine(author)
    if (name) {
      parts.push(
        `<text x="${GENERATED_COVER_WIDTH / 2}" y="805" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="24" letter-spacing="4" fill="${foreground}" fill-opacity="0.9">${escapeXml(name)}</text>`,
      )
    }
  } else {
    parts.push(
      `<rect x="${GENERATED_COVER_WIDTH / 2 - 40}" y="728" width="80" height="3" fill="${foreground}" fill-opacity="0.8"/>`,
    )
  }

  parts.push("</svg>")
  return parts.join("")
}

let textProbe: Promise<boolean> | undefined

/**
 * true when librsvg can draw text here. with no usable font the glyphs come
 * out empty or as boxes, which is far fewer painted pixels than real glyphs.
 */
export function canRenderText(): Promise<boolean> {
  textProbe ??= (async () => {
    try {
      const sharp = await getSharp()
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="60" font-family="${FONT_FAMILY}" font-weight="bold" font-size="40" fill="#000">Ag</text></svg>`
      const { data } = await sharp(Buffer.from(svg))
        .raw()
        .toBuffer({ resolveWithObject: true })
      let painted = 0
      for (let i = 3; i < data.length; i += 4) if (data[i]) painted++
      const ok = painted > 300
      if (!ok) {
        logger.warn(
          "No usable fonts found for generated covers; drawing them without text. Install a font such as fonts-dejavu-core in the server image.",
        )
      }
      return ok
    } catch {
      return false
    }
  })()
  return textProbe
}

export type GeneratedCover = {
  filename: string
  mimeType: string
  data: Buffer
}

export async function renderGeneratedCover(
  title: string,
  author?: string | null,
): Promise<GeneratedCover> {
  const sharp = await getSharp()
  const svg = buildCoverSvg(title, author, { text: await canRenderText() })
  const data = await sharp(Buffer.from(svg), { density: 72 })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return { filename: "generated-cover.png", mimeType: "image/png", data }
}
