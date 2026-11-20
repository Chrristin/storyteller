import * as Haptics from "expo-haptics"
import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { type AccessibilityActionEvent, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"

import { type BookWithRelations } from "@/database/books"
import {
  capPileBooks,
  dotWindow,
  peekIndexes,
  stepIndex,
  swipeDecision,
} from "@/lib/swipePile"
import { fallbackColor, hexToRgb } from "@/lib/waves"

import { BookCover } from "./BookCover"
import { Text } from "./ui/text"

/** Cover width as a share of the tile, the rest is room for the peeking edges. */
const COVER_RATIO = 0.8
/** Edge offsets as a share of the tile width: right, and up. */
const EDGE_DX_RATIO = 0.06
const EDGE_DY_RATIO = 0.03
const EDGE_OPACITY = [0.82, 0.64]
/** Only clearly horizontal drags belong to the pile, vertical ones scroll. */
const ACTIVE_OFFSET_X = 10
const FAIL_OFFSET_Y = 10

function lightHaptic() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  } catch {
    // Haptics are a nicety, never a reason to fail.
  }
}

function edgeColor(book: BookWithRelations) {
  const rgb =
    hexToRgb(book.audioCoverColor ?? book.textCoverColor ?? "") ??
    fallbackColor(book.uuid)
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`
}

interface Props {
  /** The books of the pile in swipe order. Only the first 30 are used. */
  books: readonly BookWithRelations[]
  /** The total shown in the badge (the real size of the pile). */
  count: number
  width: number
  /** Screen reader label, for example "Andy Weir, 10 books". */
  label: string
  /** What a tap opens. */
  onOpen: () => void
  /** The text lines under the cover. */
  children?: ReactNode
}

/**
 * A pile of books as one front cover with the edges of the next two peeking
 * out behind it, a count badge and position dots. A horizontal drag on the
 * tile moves through the books (wrapping round); a tap opens the pile.
 *
 * Only the front cover is a real BookCover. The edges are plain rounded
 * rectangles in the books' cover colours, so nothing else is loaded.
 */
export function SwipePile({
  books,
  count,
  width,
  label,
  onOpen,
  children,
}: Props) {
  const list = useMemo(() => capPileBooks(books), [books])
  const total = list.length
  const [index, setIndex] = useState(0)
  const current = Math.min(index, Math.max(0, total - 1))
  const front = list[current]

  const coverWidth = Math.round(width * COVER_RATIO)
  const coverHeight = Math.round(coverWidth * 1.5)
  const dx = Math.round(width * EDGE_DX_RATIO)
  const dy = Math.round(width * EDGE_DY_RATIO)
  const topPad = dy * 2

  const translateX = useSharedValue(0)
  const appear = useSharedValue(1)

  const go = useCallback(
    (step: number) => {
      if (total < 2) return
      setIndex((i) => stepIndex(Math.min(i, total - 1), total, step))
      lightHaptic()
    },
    [total],
  )

  // The new front cover starts under the old one's last position, so reset the
  // drag and fade the new cover in once React has swapped the book.
  const first = useRef(true)
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    translateX.value = 0
    appear.value = 0
    appear.value = withTiming(1, { duration: 140 })
  }, [current, translateX, appear])

  const pan = Gesture.Pan()
    .activeOffsetX([-ACTIVE_OFFSET_X, ACTIVE_OFFSET_X])
    .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
    .onUpdate((event) => {
      "worklet"

      if (total < 2) return
      translateX.value = event.translationX
    })
    .onEnd((event) => {
      "worklet"

      const step = swipeDecision(
        event.translationX,
        event.velocityX,
        width,
        total,
      )
      if (step === 0) {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 })
        return
      }
      // Dragging left (negative) goes to the next book (+1).
      translateX.value = withTiming(
        step > 0 ? -width * 1.3 : width * 1.3,
        { duration: 160 },
        (finished) => {
          if (finished) scheduleOnRN(go, step)
        },
      )
    })

  // A tap is a touch that does not move: the pan only activates after 10px
  // sideways, and Race lets whichever recognises first win, so a swipe never
  // also opens the pile.
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(ACTIVE_OFFSET_X)
    .onEnd((_event, success) => {
      if (success) onOpen()
    })

  const gesture = Gesture.Race(pan, tap)

  const frontStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateX: translateX.value },
      { rotate: `${(translateX.value / width) * 10}deg` },
    ],
  }))

  function onAccessibilityAction(event: AccessibilityActionEvent) {
    switch (event.nativeEvent.actionName) {
      case "activate":
        onOpen()
        break
      case "increment":
        go(1)
        break
      case "decrement":
        go(-1)
        break
    }
  }

  if (!front) return null

  const dots = dotWindow(current, total)
  const peeks = peekIndexes(current, total)
  const position = total > 1 ? `, book ${current + 1} of ${total}` : ""

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${label}${position}`}
        accessibilityActions={[
          { name: "activate" },
          { name: "increment", label: "Next book" },
          { name: "decrement", label: "Previous book" },
        ]}
        onAccessibilityAction={onAccessibilityAction}
        className="pb-3"
        style={{ width }}
      >
        <View style={{ height: coverHeight + topPad, width }}>
          {/* Farthest edge first so the nearer one draws over it. */}
          {[...peeks].reverse().map((peekIndex) => {
            const depth = peeks.indexOf(peekIndex) + 1
            const peekBook = list[peekIndex]!
            return (
              <View
                key={`${depth}-${peekBook.uuid}`}
                pointerEvents="none"
                style={{
                  backgroundColor: edgeColor(peekBook),
                  borderRadius: 6,
                  height: coverHeight,
                  left: dx * depth,
                  opacity: EDGE_OPACITY[depth - 1],
                  position: "absolute",
                  top: topPad - dy * depth,
                  width: coverWidth,
                }}
              />
            )
          })}
          <Animated.View
            style={[{ left: 0, position: "absolute", top: topPad }, frontStyle]}
          >
            <BookCover
              key={front.uuid}
              book={front}
              badge={false}
              progressLine={false}
              showTitleOverlay={false}
              width={coverWidth}
              height={coverHeight}
            />
          </Animated.View>
          <View
            pointerEvents="none"
            className="bg-primary absolute h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5"
            style={{ bottom: -6, right: 0 }}
          >
            <Text className="text-primary-foreground text-[11px] leading-[14px] font-bold">
              {count}
            </Text>
          </View>
        </View>
        {dots.count > 1 && (
          <View
            pointerEvents="none"
            className="mt-2.5 flex-row items-center gap-1"
          >
            {Array.from({ length: dots.count }, (_, i) => (
              <View
                key={i}
                className={
                  i === dots.active
                    ? "bg-primary h-[5px] w-3.5 rounded-full"
                    : "bg-muted-foreground/30 size-[5px] rounded-full"
                }
              />
            ))}
          </View>
        )}
        <View className="mt-2">{children}</View>
      </View>
    </GestureDetector>
  )
}
