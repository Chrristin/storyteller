import { useRouter } from "expo-router"
import { useMemo } from "react"
import { Pressable, ScrollView, View } from "react-native"

import { MiniPlayerWidget } from "@/components/MiniPlayerWidget"
import { ScreenHeader } from "@/components/ScreenHeader"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { buildMissing } from "@/lib/piles"
import { type SeriesGap } from "@/lib/seriesGaps"
import { cn } from "@/lib/utils"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []

function NumberRow({ gap }: { gap: SeriesGap }) {
  const owned = new Set(gap.owned)
  const missing = new Set(gap.missing)
  const first = gap.owned[0] ?? 1
  const numbers: number[] = []
  for (let n = first; n <= gap.upTo; n++) numbers.push(n)

  return (
    <View className="mt-3 flex-row flex-wrap gap-1.5">
      {numbers.map((n) => (
        <View
          key={n}
          className={cn(
            "size-8 items-center justify-center rounded-md",
            owned.has(n) && "bg-primary",
            missing.has(n) && "border-missing border border-dashed",
          )}
        >
          <Text
            className={cn(
              "text-xs font-semibold",
              owned.has(n) ? "text-primary-foreground" : "text-missing",
            )}
          >
            {n}
          </Text>
        </View>
      ))}
    </View>
  )
}

export default function MissingScreen() {
  const router = useRouter()
  const { data: books = EMPTY_BOOKS } = useListBooksQuery()
  const gaps = useMemo(() => buildMissing(books), [books])

  return (
    <ScreenHeader title="Missing books">
      <ScrollView
        className="w-full flex-1"
        contentContainerClassName="px-safe-or-5 gap-3 pt-2"
      >
        <Text className="text-muted-foreground text-sm">
          Only gaps between books you own are shown. A series is never guessed
          past its last book on this phone.
        </Text>
        {gaps.length === 0 && (
          <Text className="text-muted-foreground py-4">
            No gaps found in your series.
          </Text>
        )}
        {gaps.map((gap) => (
          <Pressable
            key={gap.uuid}
            accessibilityRole="button"
            accessibilityLabel={`${gap.name}, missing ${gap.missing.join(", ")}`}
            className="bg-card rounded-xl p-4"
            onPress={() =>
              router.push({
                pathname: "/series/[uuid]",
                params: { uuid: gap.uuid },
              })
            }
          >
            <Text className="text-base font-semibold" numberOfLines={1}>
              {gap.name}
            </Text>
            {gap.authors.length > 0 && (
              <Text
                className="text-muted-foreground mt-0.5 text-sm"
                numberOfLines={1}
              >
                {gap.authors.join(", ")}
              </Text>
            )}
            <Text className="text-missing mt-2 text-sm font-semibold">
              Missing {gap.missing.map((n) => `#${n}`).join(", ")}
            </Text>
            <NumberRow gap={gap} />
          </Pressable>
        ))}
        <View className="h-40 w-full" />
      </ScrollView>
      <MiniPlayerWidget />
    </ScreenHeader>
  )
}
