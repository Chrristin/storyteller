import { blurhashAverageColor } from "./blurhash"

type CoverLike =
  | {
      blurhash?: string | null
      colors?: { r: number; g: number; b: number }[] | null
    }
  | null
  | undefined

/** The main colour of a server cover as "#rrggbb": first colour, else blurhash. */
export function coverMainColor(cover: CoverLike): string | null {
  const first = cover?.colors?.[0]
  if (first) {
    const h = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, "0")
    return `#${h(first.r)}${h(first.g)}${h(first.b)}`
  }
  return blurhashAverageColor(cover?.blurhash)
}
