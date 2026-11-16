import { Link, useRouter } from "expo-router"
import { useMemo, useState } from "react"
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { MiniPlayerWidget } from "@/components/MiniPlayerWidget"
import { PileStack } from "@/components/PileStack"
import { ScreenHeader } from "@/components/ScreenHeader"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { usesSystemHeader } from "@/lib/nativeChrome"
import { type PileKind, buildMissing, buildPiles } from "@/lib/piles"
import { cn } from "@/lib/utils"
import { useListBooksQuery } from "@/store/localApi"

const EMPTY_BOOKS: BookWithRelations[] = []
const GAP = 12
const SIDE = 20

export default function PilesScreen() {
  const router = useRouter()
  const dimensions = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [kind, setKind] = useState<PileKind>("series")
  const { data: books = EMPTY_BOOKS } = useListBooksQuery()

  const piles = useMemo(() => buildPiles(books, kind), [books, kind])
  const missingCount = useMemo(() => buildMissing(books).length, [books])

  const cellWidth = Math.floor(
    (dimensions.width - insets.left - insets.right - SIDE * 2 - GAP) / 2,
  )

  const missingLink =
    missingCount > 0 ? (
      <Link href="/missing" asChild>
        <Pressable accessibilityRole="link" hitSlop={8}>
          <Text className="text-missing text-[13px] font-semibold">
            Missing books ({missingCount})
          </Text>
        </Pressable>
      </Link>
    ) : null

  return (
    <ScreenHeader title="Piles" right={missingLink}>
      <ScrollView
        className="w-full flex-1"
        contentContainerStyle={{
          paddingHorizontal: SIDE + Math.max(insets.left, insets.right),
        }}
      >
        <View className="flex-row items-center justify-between gap-3 py-2">
          <View className="bg-secondary flex-row rounded-lg p-0.5">
            {(["series", "author"] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === option }}
                className={cn(
                  "rounded-md px-4 py-1.5",
                  kind === option && "bg-background",
                )}
                onPress={() => setKind(option)}
              >
                <Text
                  className={cn(
                    "text-sm font-semibold",
                    kind !== option && "text-muted-foreground",
                  )}
                >
                  {option === "series" ? "Series" : "Authors"}
                </Text>
              </Pressable>
            ))}
          </View>
          {/* The system bar has no room for it, so the link sits next to the
              control there. Elsewhere it is in the title row. */}
          {usesSystemHeader ? missingLink : null}
        </View>

        {piles.length === 0 ? (
          <Text className="text-muted-foreground py-6">
            {kind === "series"
              ? "None of your books are in a series yet."
              : "No authors yet."}
          </Text>
        ) : (
          <View className="flex-row flex-wrap" style={{ columnGap: GAP }}>
            {piles.map((pile) => (
              <Pressable
                key={`${pile.kind}-${pile.uuid}`}
                accessibilityRole="button"
                accessibilityLabel={`${pile.name}, ${pile.count} books${
                  pile.missing > 0 ? `, ${pile.missing} missing` : ""
                }`}
                className="pt-2 pb-4"
                style={{ width: cellWidth }}
                onPress={() =>
                  pile.kind === "series"
                    ? router.push({
                        pathname: "/series/[uuid]",
                        params: { uuid: pile.uuid },
                      })
                    : router.push({
                        pathname: "/author/[uuid]",
                        params: { uuid: pile.uuid },
                      })
                }
              >
                <PileStack covers={pile.covers} width={cellWidth} />
                <Text className="mt-3 text-sm font-semibold" numberOfLines={1}>
                  {pile.name}
                </Text>
                <View className="mt-0.5 flex-row items-center gap-1.5">
                  <Text className="text-muted-foreground text-xs">
                    {pile.count} {pile.count === 1 ? "book" : "books"}
                  </Text>
                  {pile.missing > 0 && (
                    <>
                      <View className="bg-missing size-1.5 rounded-full" />
                      <Text className="text-missing text-xs">
                        {pile.missing} missing
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <View className="h-40 w-full" />
      </ScrollView>
      <MiniPlayerWidget />
    </ScreenHeader>
  )
}
