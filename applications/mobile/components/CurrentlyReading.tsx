import { ChevronUp, Play } from "lucide-react-native"
import { useState } from "react"
import { Pressable, ScrollView, View } from "react-native"
import Animated, {
  FadeIn,
  LinearTransition,
  LayoutAnimationConfig,
} from "react-native-reanimated"
import Svg, { Circle } from "react-native-svg"
import { useCSSVariable } from "uniwind"

import { type BookWithRelations } from "@/database/books"
import { pickFormat, useOpenBook } from "@/hooks/useOpenBook"

import { AudiobookCover } from "./AudiobookCover"
import { BookCover } from "./BookCover"
import { EbookCover } from "./EbookCover"
import { Icon } from "./ui/icon"
import { Text } from "./ui/text"

const RING_SIZE = 48
const RING_STROKE = 3

function getPercent(book: BookWithRelations) {
  const progression = book.position?.locator.locations?.totalProgression
  return typeof progression === "number"
    ? Math.max(0, Math.min(100, Math.round(progression * 100)))
    : null
}

function formatKind(book: BookWithRelations) {
  if (book.readaloud) return "Read-aloud"
  if (book.ebook && book.audiobook) return "Ebook and audiobook"
  if (book.audiobook) return "Audiobook"
  if (book.ebook) return "Ebook"
  return null
}

/** The position timestamp is in milliseconds. */
function formatLastRead(timestamp: number | undefined, now = Date.now()) {
  if (!timestamp) return null
  const startOfDay = (value: number) => {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date.valueOf()
  }
  const days = Math.round(
    (startOfDay(now) - startOfDay(timestamp)) / 86_400_000,
  )
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 14) return "last week"
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return new Date(timestamp).toLocaleDateString()
}

function ProgressBar({
  percent,
  height,
  textClassName,
}: {
  percent: number | null
  height: number
  textClassName: string
}) {
  if (percent === null) return null
  return (
    <View className="mt-2 flex-row items-center gap-2">
      <View
        className="bg-border flex-1 overflow-hidden rounded-full"
        style={{ height }}
      >
        <View className="bg-primary h-full" style={{ width: `${percent}%` }} />
      </View>
      <Text className={textClassName}>{percent}%</Text>
    </View>
  )
}

/** A small round cover with a ring around it that fills as you read. */
function RoundCover({
  book,
  selected,
  onPress,
}: {
  book: BookWithRelations
  selected: boolean
  onPress: () => void
}) {
  const primary = useCSSVariable("--color-primary") as string
  const track = useCSSVariable("--color-border") as string
  const percent = getPercent(book) ?? 0
  const radius = (RING_SIZE - RING_STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const hasTextCover = !!book.ebook || !!book.readaloud
  const inner = RING_SIZE - RING_STROKE * 2 - 2

  return (
    <Pressable
      accessibilityLabel={`${book.title}, ${percent}% read`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={
        selected
          ? "border-primary rounded-full border-[1.5px] p-0.5"
          : "rounded-full border-[1.5px] border-transparent p-0.5"
      }
      onPress={onPress}
    >
      <View
        className="items-center justify-center"
        style={{ height: RING_SIZE, width: RING_SIZE }}
      >
        <Svg
          height={RING_SIZE}
          style={{ position: "absolute" }}
          width={RING_SIZE}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={radius}
            stroke={track}
            strokeWidth={RING_STROKE}
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            r={radius}
            rotation={-90}
            stroke={primary}
            strokeDasharray={`${(circumference * percent) / 100} ${circumference}`}
            strokeLinecap="round"
            strokeWidth={RING_STROKE}
          />
        </Svg>
        <View
          className="bg-secondary overflow-hidden"
          style={{ borderRadius: inner / 2, height: inner, width: inner }}
        >
          {hasTextCover ? (
            <EbookCover book={book} />
          ) : (
            <AudiobookCover book={book} />
          )}
        </View>
      </View>
    </Pressable>
  )
}

/**
 * The top of the Library. The book you read last is a compact card with a play
 * button. Any other book in progress is a small round cover with a progress
 * ring; tap one to expand the card to that book, and tap the up arrow (or the
 * first round cover) to go back to the compact card.
 */
export function CurrentlyReading({ books }: { books: BookWithRelations[] }) {
  const { openFormat, openDetails } = useOpenBook()
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)

  const first = books[0]
  if (!first) return null

  const expandedBook =
    selectedUuid && selectedUuid !== first.uuid
      ? books.find((book) => book.uuid === selectedUuid)
      : undefined
  const current = expandedBook ?? first

  function resume(book: BookWithRelations) {
    const format = pickFormat(book)
    if (format) openFormat(book, format)
    else openDetails(book)
  }

  const percent = getPercent(current)
  const kind = formatKind(current)
  const chapter = current.position?.locator.title?.trim() || null
  const lastRead = formatLastRead(current.position?.timestamp)

  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View
        className="bg-card rounded-2xl p-3"
        layout={LinearTransition.duration(200)}
      >
        {expandedBook ? (
          <Animated.View entering={FadeIn.duration(150)} key="expanded">
            <View className="flex-row gap-3.5">
              <BookCover
                badge={false}
                book={current}
                height={132}
                progressLine={false}
                width={88}
              />
              <View className="min-w-0 flex-1">
                <View className="flex-row items-start justify-between gap-2">
                  <Text
                    className="flex-1 text-[17px] leading-5 font-semibold"
                    numberOfLines={3}
                  >
                    {current.title}
                  </Text>
                  <Pressable
                    accessibilityLabel="Collapse"
                    accessibilityRole="button"
                    className="bg-secondary size-7 items-center justify-center rounded-full"
                    onPress={() => setSelectedUuid(null)}
                  >
                    <Icon as={ChevronUp} size={14} />
                  </Pressable>
                </View>
                {current.authors[0] && (
                  <Text
                    className="text-muted-foreground mt-1 text-[13px]"
                    numberOfLines={1}
                  >
                    {current.authors[0].name}
                  </Text>
                )}
                <ProgressBar
                  height={4}
                  percent={percent}
                  textClassName="text-xs font-semibold"
                />
                <View className="mt-2 gap-0.5">
                  {kind && (
                    <Text className="text-muted-foreground text-xs">
                      {kind}
                    </Text>
                  )}
                  {chapter && (
                    <Text
                      className="text-muted-foreground text-xs"
                      numberOfLines={1}
                    >
                      {chapter}
                    </Text>
                  )}
                  {lastRead && (
                    <Text className="text-muted-foreground text-xs">
                      Last read {lastRead}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityLabel={`Continue ${current.title}`}
                accessibilityRole="button"
                className="bg-primary h-10 flex-1 items-center justify-center rounded-full"
                onPress={() => resume(current)}
              >
                <Text className="text-primary-foreground text-sm font-semibold">
                  Continue
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Details for ${current.title}`}
                accessibilityRole="button"
                className="border-border h-10 items-center justify-center rounded-full border px-4"
                onPress={() => openDetails(current)}
              >
                <Text className="text-sm">Details</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(150)} key="compact">
            <Pressable
              accessibilityLabel={`Continue ${first.title}`}
              accessibilityRole="button"
              className="flex-row items-center gap-3"
              onPress={() => resume(first)}
            >
              <BookCover
                badge={false}
                book={first}
                height={84}
                progressLine={false}
                width={56}
              />
              <View className="min-w-0 flex-1">
                <Text className="text-primary text-[11px] font-semibold tracking-wider">
                  CONTINUE
                </Text>
                <Text
                  className="mt-0.5 text-[15px] font-semibold"
                  numberOfLines={1}
                >
                  {first.title}
                </Text>
                {first.authors[0] && (
                  <Text
                    className="text-muted-foreground mt-0.5 text-xs"
                    numberOfLines={1}
                  >
                    {first.authors[0].name}
                  </Text>
                )}
                <ProgressBar
                  height={3}
                  percent={getPercent(first)}
                  textClassName="text-muted-foreground text-[11px]"
                />
              </View>
              <View className="bg-primary size-10 items-center justify-center rounded-full">
                <Icon
                  as={Play}
                  className="text-primary-foreground"
                  fill="currentColor"
                  size={16}
                />
              </View>
            </Pressable>
          </Animated.View>
        )}

        {books.length > 1 && (
          <ScrollView
            className="border-border mt-3 border-t pt-3"
            contentContainerClassName="gap-3"
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {books.map((book) => (
              <RoundCover
                key={book.uuid}
                book={book}
                selected={book.uuid === current.uuid}
                onPress={() =>
                  setSelectedUuid(book.uuid === first.uuid ? null : book.uuid)
                }
              />
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </LayoutAnimationConfig>
  )
}
