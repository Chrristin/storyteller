import { type BookFormat } from "./bookPrefs"

/** Only formats with narration can start playing by themselves. */
export function shouldAutoplay(format: BookFormat | null | undefined) {
  return format === "audiobook" || format === "readaloud"
}

/** The value passed as the `autoplay` route param, or undefined for none. */
export function autoplayParam(
  format: BookFormat,
  options?: { autoplay?: boolean },
) {
  return options?.autoplay && shouldAutoplay(format) ? "1" : undefined
}

/** Reads the `autoplay` route param back. */
export function isAutoplayParam(value: string | string[] | undefined) {
  return value === "1"
}
