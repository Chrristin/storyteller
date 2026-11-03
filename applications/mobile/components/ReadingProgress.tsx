import { useEffect, useState } from "react"
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

import { cn } from "@/lib/utils"

type Props = {
  accessibilityLabel?: string | undefined
  className?: string | undefined
  start: number
  stop: number
  progress: number
  onProgressChange?: ((newProgress: number) => void) | undefined
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const TRACK = 3
const DOT = 9

/**
 * A thin reading progress line. The current location is a dot with a ring
 * that pulses outward. Tap or drag to move when `onProgressChange` is given.
 */
export function ReadingProgress({
  accessibilityLabel,
  className,
  start,
  stop,
  progress,
  onProgressChange,
}: Props) {
  const reduceMotion = useReducedMotion()
  const [width, setWidth] = useState(0)
  const range = stop - start
  const hasRange = range > 0
  const fraction = hasRange ? clamp((progress - start) / range, 0, 1) : 0
  const x = width * fraction

  const pulse = useSharedValue(0)
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(pulse)
      pulse.value = 0
      return
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
      -1,
    )
    return () => cancelAnimation(pulse)
  }, [pulse, reduceMotion])

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.8 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.8 }],
  }))

  const seekTo = (px: number) => {
    if (!onProgressChange || !hasRange || width <= 0) return
    onProgressChange(start + clamp(px / width, 0, 1) * range)
  }

  const gesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .enabled(!!onProgressChange && hasRange)
    .onBegin((event) => seekTo(event.x))
    .onUpdate((event) => seekTo(event.x))

  const bar = (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={
        hasRange ? { min: start, max: stop, now: progress } : {}
      }
      className={cn("h-6 justify-center", className)}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View className="bg-border rounded-full" style={{ height: TRACK }} />
      <View
        className="bg-primary absolute left-0 rounded-full"
        style={{ height: TRACK, width: x }}
      />
      <View
        className="absolute"
        style={{
          height: DOT,
          left: x - DOT / 2,
          top: (24 - DOT) / 2,
          width: DOT,
        }}
      >
        <Animated.View
          className="border-primary absolute inset-0 rounded-full border-2"
          style={ringStyle}
        />
        <View className="bg-primary size-full rounded-full" />
      </View>
    </View>
  )

  return onProgressChange ? (
    <GestureDetector gesture={gesture}>{bar}</GestureDetector>
  ) : (
    bar
  )
}
