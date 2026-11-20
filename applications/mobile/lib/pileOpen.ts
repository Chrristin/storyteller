import { type BookFormat } from "./bookPrefs"

/**
 * Pure rules for opening a book from a pile (components/SwipePile.tsx).
 * Normal thumbnails do not use this: they keep opening the last or default
 * format without asking (hooks/useOpenBook.ts).
 */

export type FormatChoice = { format: BookFormat; label: string }

export type PileOpenDecision =
  | { kind: "details" }
  | { kind: "open"; format: BookFormat; autoplay: boolean }
  | { kind: "ask"; choices: FormatChoice[] }

/** Buttons in the order they are shown. */
const CHOICE_ORDER: BookFormat[] = ["ebook", "readaloud", "audiobook"]

export const FORMAT_CHOICE_LABEL: Record<BookFormat, string> = {
  ebook: "Read",
  readaloud: "Read along",
  audiobook: "Listen",
}

/** Only formats with narration start playing by themselves from a pile. */
export function pileAutoplay(format: BookFormat) {
  return format === "audiobook" || format === "readaloud"
}

/** The choice buttons for the openable formats (Read, Read along, Listen). */
export function formatChoices(openable: readonly BookFormat[]): FormatChoice[] {
  return CHOICE_ORDER.filter((format) => openable.includes(format)).map(
    (format) => ({ format, label: FORMAT_CHOICE_LABEL[format] }),
  )
}

/** The sheet title, for example "Read or listen". */
export function sheetTitle(choices: readonly FormatChoice[]) {
  const labels = choices.map((c) => c.label.toLowerCase())
  if (labels.length === 0) return ""
  const text =
    labels.length === 1
      ? labels[0]!
      : `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * What a tap (or, with `forceAsk`, a long press) on a pile's front cover does.
 *
 * - Nothing downloaded: the book's details page.
 * - One openable format: open it.
 * - A remembered format that is still openable: open it (unless `forceAsk`).
 * - Both an audio format (audiobook or read-aloud) and a text format (ebook),
 *   with nothing remembered: ask.
 * - `forceAsk` with two or more formats: ask.
 * - Otherwise: the first openable format (read-aloud, ebook, audiobook).
 */
export function decidePileOpen(
  openable: readonly BookFormat[],
  lastFormat: BookFormat | undefined,
  forceAsk = false,
): PileOpenDecision {
  if (openable.length === 0) return { kind: "details" }
  const open = (format: BookFormat): PileOpenDecision => ({
    kind: "open",
    format,
    autoplay: pileAutoplay(format),
  })
  if (openable.length === 1) return open(openable[0]!)
  if (forceAsk) return { kind: "ask", choices: formatChoices(openable) }
  if (lastFormat && openable.includes(lastFormat)) return open(lastFormat)
  const hasAudio =
    openable.includes("audiobook") || openable.includes("readaloud")
  if (hasAudio && openable.includes("ebook")) {
    return { kind: "ask", choices: formatChoices(openable) }
  }
  return open(openable[0]!)
}
