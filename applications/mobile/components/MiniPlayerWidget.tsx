import { skipToken } from "@reduxjs/toolkit/query"
import { Link } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  TouchableOpacity,
  View,
  type ViewStyle,
  useWindowDimensions,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { useCSSVariable } from "uniwind"

import { playerPositionSeeked } from "@/store/actions"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { useGetBookQuery } from "@/store/localApi"
import {
  formatTime,
  getCurrentTrackDuration,
  getCurrentlyPlayingBookUuid,
  getCurrentlyPlayingFormat,
  getFormattedDuration,
  getIsPlaying,
  getPlaybackRate,
  getPosition,
} from "@/store/selectors/bookshelfSelectors"
import { bookshelfSlice } from "@/store/slices/bookshelfSlice"

import { AudiobookCover } from "./AudiobookCover"
import { PlayPause } from "./PlayPause"
import { WaveProgress } from "./WaveProgress"
import { Text } from "./ui/text"

/** How far a sideways swipe moves the audio, in seconds per pixel. */
const SECONDS_PER_PIXEL = 1

export function MiniPlayerWidget() {
  const progress = useAppSelector(getPosition)
  const startPosition = 0
  const endPosition = useAppSelector(getCurrentTrackDuration)
  const rate = useAppSelector(getPlaybackRate)
  const isPlaying = useAppSelector(getIsPlaying)
  const primaryColor = useCSSVariable("--color-primary") as string
  const formattedDuration = useAppSelector(getFormattedDuration)

  const dimensions = useWindowDimensions()

  const dispatch = useAppDispatch()
  const [eagerProgress, setEagerProgress] = useState(progress)

  const formattedEagerProgress = useMemo(() => {
    return formatTime(eagerProgress, rate)
  }, [eagerProgress, rate])

  const formattedProgress = useMemo(() => {
    return `${formattedEagerProgress} / ${formattedDuration}`
  }, [formattedEagerProgress, formattedDuration])

  // While a finger is scrubbing, playback updates must not move the bar.
  const scrubbing = useRef(false)
  useEffect(() => {
    if (!scrubbing.current) setEagerProgress(progress)
  }, [progress])

  const bookUuid = useAppSelector(getCurrentlyPlayingBookUuid)
  const format = useAppSelector(getCurrentlyPlayingFormat)
  const { data: book } = useGetBookQuery(
    bookUuid ? { uuid: bookUuid } : skipToken,
  )

  function dismiss() {
    dispatch(bookshelfSlice.actions.miniPlayerWidgetSwiped())
    translateY.set(0)
  }

  const translateY = useSharedValue(0)

  // Swiping sideways across the card seeks: one second of audio per pixel,
  // starting from where the audio is when the finger lands.
  const seekStart = useRef(0)
  const seekGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      seekStart.current = eagerProgress
      scrubbing.current = true
    })
    .onUpdate((event) => {
      setEagerProgress(
        Math.min(
          endPosition,
          Math.max(
            0,
            seekStart.current + event.translationX * SECONDS_PER_PIXEL,
          ),
        ),
      )
    })
    .onEnd((event) => {
      const next = Math.min(
        endPosition,
        Math.max(0, seekStart.current + event.translationX * SECONDS_PER_PIXEL),
      )
      setEagerProgress(next)
      dispatch(playerPositionSeeked({ progress: next }))
    })
    .onFinalize(() => {
      scrubbing.current = false
    })

  // A vertical flick, up or down, dismisses the player.
  const dismissGesture = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onUpdate((event) => {
      "worklet"

      translateY.set(event.translationY)
    })
    .onEnd((event) => {
      "worklet"

      const flicked = Math.abs(event.velocityY) > 800
      if (flicked || Math.abs(event.translationY) > 60) {
        translateY.value = withTiming(
          event.translationY < 0 ? -dimensions.height : dimensions.height,
          { duration: 350, easing: Easing.out(Easing.quad) },
        )
        scheduleOnRN(dismiss)
      } else {
        translateY.value = withTiming(0, {
          duration: 150,
          easing: Easing.out(Easing.quad),
        })
      }
    })

  const gesture = Gesture.Exclusive(seekGesture, dismissGesture)

  const widgetAnimatedStyle = useAnimatedStyle((): ViewStyle => ({
    transform: [{ translateY: translateY.value }],
  }))

  if (format === "ebook") return null

  if (!bookUuid) return null

  return (
    <Animated.View
      className="mb-safe-offset-2 right-safe-or-3 left-safe-or-3 absolute bottom-0 z-90 rounded-xl"
      style={widgetAnimatedStyle}
    >
      <View
        className="bg-card ios:rounded-t-none rounded-xl border"
        style={{
          borderColor: primaryColor + "66",
          elevation: 10,
          shadowColor: primaryColor,
          shadowOpacity: 0.45,
          shadowRadius: 12,
        }}
      >
        {book && (
          <GestureDetector gesture={gesture}>
            <View>
              <View className="my-2 flex-row items-center justify-between gap-3 pr-3">
                <Link
                  href={{
                    pathname: "/listen/[uuid]",
                    params: { uuid: bookUuid, format },
                  }}
                  asChild
                >
                  <TouchableOpacity
                    accessibilityLabel={`Open audio player for ${book.title}`}
                    accessibilityRole="button"
                    className="shrink flex-row items-center justify-between gap-3 px-3"
                  >
                    <View className="h-10 w-10">
                      <AudiobookCover book={book} style={{ borderRadius: 6 }} />
                    </View>
                    <View>
                      <Text numberOfLines={1} className="text-sm font-semibold">
                        {book.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        className="text-muted-foreground text-xs"
                      >
                        {formattedProgress}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Link>
                <PlayPause />
              </View>
              <WaveProgress
                accessibilityLabel="Mini player progress"
                className="mx-4 mb-2"
                height={14}
                paused={!isPlaying}
                start={startPosition}
                stop={endPosition}
                progress={eagerProgress}
              />
            </View>
          </GestureDetector>
        )}
      </View>
    </Animated.View>
  )
}
