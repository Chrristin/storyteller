const BASE83 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"

function decode83(value: string): number | null {
  let result = 0
  for (const ch of value) {
    const i = BASE83.indexOf(ch)
    if (i < 0) return null
    result = result * 83 + i
  }
  return result
}

/** The average colour (the DC component) of a blurhash as "#rrggbb", or null. */
export function blurhashAverageColor(hash: string | null | undefined) {
  if (!hash || hash.length < 6) return null
  const dc = decode83(hash.slice(2, 6))
  if (dc === null) return null
  const h = (n: number) => n.toString(16).padStart(2, "0")
  return `#${h((dc >> 16) & 255)}${h((dc >> 8) & 255)}${h(dc & 255)}`
}
