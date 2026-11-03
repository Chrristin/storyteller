import { skipToken } from "@reduxjs/toolkit/query"
import { Link } from "expo-router"
import { useEffect, useMemo, useState } from "react"
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

  useEffect(() => {
    setEagerProgress(progress)
  }, [progress])

  const bookUuid = useAppSelector(getCurrentlyPlayingBookUuid)
  const format = useAppSelector(getCurrentlyPlayingFormat)
  const { data: book } = useGetBookQuery(
    bookUuid ? { uuid: bookUuid } : skipToken,
  )

  function onPanEnd() {
    dispatch(bookshelfSlice.actions.miniPlayerWidgetSwiped())
    translateX.set(0)
  }

  const translateX = useSharedValue(0)

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      "worklet"

      translateX.set(event.translationX)
    })
    .onEnd((event) => {
      "worklet"

      if (Math.abs(event.translationX) > dimensions.width * 0.25) {
        translateX.value = withTiming(
          dimensions.width * (event.translationX < 1 ? -2 : 2),
          {
            duration: 1200,
            easing: Easing.out(Easing.quad),
          },
        )
        scheduleOnRN(onPanEnd)
      } else {
        translateX.value = withTiming(0, {
          duration: 150,
          easing: Easing.out(Easing.quad),
        })
      }
    })

  const widgetAnimatedStyle = useAnimatedStyle((): ViewStyle => ({
    transform: [{ translateX: translateX.value }],
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
          <View>
            <GestureDetector gesture={panGesture}>
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
            </GestureDetector>
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
        )}
      </View>
    </Animated.View>
  )
}
