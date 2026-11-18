import { useRouter } from "expo-router"
import { ChevronRight, Play } from "lucide-react-native"
import { Pressable, View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { pickFormat, useOpenBook } from "@/hooks/useOpenBook"
import {
  circleBooks,
  NOW_READING_SHELF_TYPE,
  NOW_READING_TITLE,
} from "@/lib/nowReading"
import { shouldAutoplay } from "@/lib/openOptions"

import { AudiobookCover } from "./AudiobookCover"
import { BookCover } from "./BookCover"
import { EbookCover } from "./EbookCover"
import { Icon } from "./ui/icon"
import { Text } from "./ui/text"

const CIRCLE_SIZE = 40

function getPercent(book: BookWithRelations) {
  const progression = book.position?.locator.locations?.totalProgression
  return typeof progression === "number"
    ? Math.max(0, Math.min(100, Math.round(progression * 100)))
    : null
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

/** A small round cover with a thin accent ring. */
function RoundCover({
  book,
  first,
}: {
  book: BookWithRelations
  first: boolean
}) {
  const hasTextCover = !!book.ebook || !!book.readaloud

  return (
    <View
      accessibilityLabel={book.title}
      className="border-primary bg-secondary overflow-hidden rounded-full border-2"
      style={{
        height: CIRCLE_SIZE,
        width: CIRCLE_SIZE,
        marginLeft: first ? 0 : -8,
      }}
    >
      {hasTextCover ? (
        <EbookCover book={book} />
      ) : (
        <AudiobookCover book={book} />
      )}
    </View>
  )
}

/**
 * The top of the Library. The book you read last is a compact card with a play
 * button. Below it, the other books in progress are small overlapping round
 * covers, with "Now Reading" on the right. Tapping either opens the Now
 * Reading page, which lists every book in progress. The row is hidden when no
 * other book is in progress.
 */
export function CurrentlyReading({ books }: { books: BookWithRelations[] }) {
  const { openFormat, openDetails } = useOpenBook()
  const router = useRouter()

  const first = books[0]
  if (!first) return null

  function resume(book: BookWithRelations, autoplay = false) {
    const format = pickFormat(book)
    if (format) {
      openFormat(book, format, { autoplay: autoplay && shouldAutoplay(format) })
    } else openDetails(book)
  }

  const others = circleBooks(books)

  return (
    <View className="bg-card rounded-2xl p-3">
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
          showTitleOverlay={false}
          width={56}
        />
        <View className="min-w-0 flex-1">
          <Text className="text-primary text-[11px] font-semibold tracking-wider">
            CONTINUE
          </Text>
          <Text className="mt-0.5 text-[15px] font-semibold" numberOfLines={1}>
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
        <Pressable
          accessibilityLabel={`Play ${first.title}`}
          accessibilityRole="button"
          className="bg-primary size-10 items-center justify-center rounded-full"
          onPress={() => resume(first, true)}
        >
          <Icon
            as={Play}
            className="text-primary-foreground"
            fill="currentColor"
            size={16}
          />
        </Pressable>
      </Pressable>

      {others.length > 0 && (
        <Pressable
          accessibilityLabel={NOW_READING_TITLE}
          accessibilityRole="button"
          className="mt-3 min-h-11 flex-row items-center justify-between"
          onPress={() =>
            router.push({
              pathname: "/shelf/[type]",
              params: { type: NOW_READING_SHELF_TYPE },
            })
          }
        >
          <View className="flex-1 flex-row items-center">
            {others.map((book, index) => (
              <RoundCover key={book.uuid} book={book} first={index === 0} />
            ))}
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-primary text-[13px] font-semibold">
              {NOW_READING_TITLE}
            </Text>
            <Icon as={ChevronRight} className="text-primary" size={18} />
          </View>
        </Pressable>
      )}
    </View>
  )
}
