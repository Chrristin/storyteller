import { useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"
import { useCSSVariable } from "uniwind"

import { cn } from "@/lib/utils"

type Props = {
  accessibilityLabel?: string | undefined
  className?: string | undefined
  /** Total height of the bar, including the wave. */
  height?: number
  start?: number
  stop: number
  progress: number
  /** When set, the bar can be tapped and dragged to seek. */
  onProgressChange?: ((newProgress: number) => void) | undefined
  onPanStart?: (() => void) | undefined
  onPanStop?: (() => void) | undefined
  /** Keep the wave still, e.g. while paused. */
  paused?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function wavePath(width: number, mid: number, amp: number, period: number) {
  let d = ""
  for (let x = 0; x <= width; x += 2) {
    const y = mid + amp * Math.sin((x / period) * 2 * Math.PI)
    d += `${d ? "L" : "M"}${x} ${y.toFixed(2)}`
  }
  return d
}

const STROKE = 3
const FRONT_PERIOD = 22
const BACK_PERIOD = 30

/**
 * A progress bar in the style of Android's wavy progress indicator: the part
 * already played is two overlapping waves that drift, the rest is a flat line,
 * and a bar marks the current position.
 */
export function WaveProgress({
  accessibilityLabel,
  className,
  height = 24,
  start = 0,
  stop,
  progress,
  onProgressChange,
  onPanStart,
  onPanStop,
  paused = false,
}: Props) {
  const primary = useCSSVariable("--color-primary") as string
  const track = useCSSVariable("--color-border") as string
  const reduceMotion = useReducedMotion()
  const [width, setWidth] = useState(0)

  const range = stop - start
  const hasRange = range > 0
  const fraction = hasRange ? clamp((progress - start) / range, 0, 1) : 0
  const playedWidth = width * fraction
  const amplitude = Math.max(1.5, height / 8)
  const mid = height / 2

  const frontD = useMemo(
    () => wavePath(width + FRONT_PERIOD * 2, mid, amplitude, FRONT_PERIOD),
    [width, mid, amplitude],
  )
  const backD = useMemo(
    () => wavePath(width + BACK_PERIOD * 2, mid, amplitude * 0.8, BACK_PERIOD),
    [width, mid, amplitude],
  )

  const frontShift = useSharedValue(0)
  const backShift = useSharedValue(0)
  const animate = !paused && !reduceMotion

  useEffect(() => {
    if (animate) {
      frontShift.value = 0
      backShift.value = 0
      frontShift.value = withRepeat(
        withTiming(-FRONT_PERIOD, { duration: 1800, easing: Easing.linear }),
        -1,
      )
      backShift.value = withRepeat(
        withTiming(-BACK_PERIOD, { duration: 2600, easing: Easing.linear }),
        -1,
      )
    } else {
      cancelAnimation(frontShift)
      cancelAnimation(backShift)
    }
  }, [animate, frontShift, backShift])

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: frontShift.value }],
  }))
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: backShift.value }],
  }))

  const seekTo = (x: number) => {
    if (!onProgressChange || !hasRange || width <= 0) return
    onProgressChange(start + clamp(x / width, 0, 1) * range)
  }

  const gesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .enabled(!!onProgressChange && hasRange)
    .onBegin((event) => {
      onPanStart?.()
      seekTo(event.x)
    })
    .onUpdate((event) => {
      seekTo(event.x)
    })
    .onFinalize(() => {
      onPanStop?.()
    })

  const bar = (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={
        hasRange ? { min: start, max: stop, now: progress } : {}
      }
      className={cn("justify-center", className)}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height }}
    >
      <View
        className="absolute right-0 rounded-full"
        style={{
          backgroundColor: track,
          height: STROKE,
          left: Math.min(width, playedWidth + 6),
          top: mid - STROKE / 2,
        }}
      />
      <View
        className="absolute top-0 left-0 overflow-hidden"
        style={{ height, width: playedWidth }}
      >
        <Animated.View style={[{ position: "absolute", left: 0 }, backStyle]}>
          <Svg height={height} width={width + BACK_PERIOD * 2}>
            <Path
              d={backD}
              fill="none"
              opacity={0.38}
              stroke={primary}
              strokeLinecap="round"
              strokeWidth={STROKE}
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[{ position: "absolute", left: 0 }, frontStyle]}>
          <Svg height={height} width={width + FRONT_PERIOD * 2}>
            <Path
              d={frontD}
              fill="none"
              stroke={primary}
              strokeLinecap="round"
              strokeWidth={STROKE}
            />
          </Svg>
        </Animated.View>
      </View>
      <View
        className="absolute rounded-full"
        style={{
          backgroundColor: primary,
          height: height - 4,
          left: Math.max(0, playedWidth - 2),
          top: 2,
          width: 4,
        }}
      />
    </View>
  )

  return onProgressChange ? (
    <GestureDetector gesture={gesture}>{bar}</GestureDetector>
  ) : (
    bar
  )
}
