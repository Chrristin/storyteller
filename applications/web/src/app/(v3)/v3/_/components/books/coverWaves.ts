// Layered wave fill for square (audiobook) covers on the tall 2:3 card.
// The phone app uses the same algorithm, so keep both in step.

export const WAVE_VIEWBOX = { width: 150, height: 95 }
export const WAVE_LAYER_COUNT = 4
export const WAVE_STEP = 3

export type Rgb = { r: number; g: number; b: number }

export type WaveLayer = {
  /* SVG path data, closed along the bottom edge of the viewBox */
  path: string
  /* css colour for this layer */
  fill: string
}

export type WaveFill = {
  /* card background behind the waves */
  background: string
  layers: WaveLayer[]
}

// 32 bit FNV-1a over the UTF-16 code units of the string
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function mix(color: Rgb, target: number, amount: number): Rgb {
  const blend = (channel: number) =>
    Math.round(channel + (target - channel) * amount)
  return { r: blend(color.r), g: blend(color.g), b: blend(color.b) }
}

export function mixWithWhite(color: Rgb, amount: number): Rgb {
  return mix(color, 255, amount)
}

export function mixWithBlack(color: Rgb, amount: number): Rgb {
  return mix(color, 0, amount)
}

export function rgbCss({ r, g, b }: Rgb): string {
  return `rgb(${r} ${g} ${b})`
}

export function waveColors(main: Rgb): { background: Rgb; layers: Rgb[] } {
  return {
    background: mixWithBlack(main, 0.5),
    layers: [
      mixWithWhite(main, 0.3),
      mixWithWhite(main, 0.12),
      mixWithBlack(main, 0.15),
      mixWithBlack(main, 0.38),
    ],
  }
}

export function wavePaths(seed: number): string[] {
  const r = createRandom(seed)
  const { width, height } = WAVE_VIEWBOX
  const paths: string[] = []

  for (let k = 0; k < WAVE_LAYER_COUNT; k++) {
    const base = 14 + k * 17 + r() * 6
    const amp = 5 + r() * 11
    const cycles = 0.9 + r() * 1.9
    const phase = r() * 2 * Math.PI

    const points: string[] = []
    for (let x = 0; x <= width; x += WAVE_STEP) {
      const y =
        base + amp * Math.sin((2 * Math.PI * cycles * x) / width + phase)
      points.push(`${x},${y.toFixed(2)}`)
    }
    paths.push(`M${points.join(" L")} L${width},${height} L0,${height} Z`)
  }

  return paths
}

export function generateWaves(seedText: string, main: Rgb): WaveFill {
  const paths = wavePaths(hashSeed(seedText))
  const colors = waveColors(main)
  return {
    background: rgbCss(colors.background),
    layers: paths.map((path, i) => ({
      path,
      fill: rgbCss(colors.layers[i] as Rgb),
    })),
  }
}
