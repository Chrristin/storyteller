import { useGlobalSearchParams, useRouter } from "expo-router"
import { View } from "react-native"

import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import {
  readerFormSheetBottomPadding,
  readerFormSheetGrabberHeight,
  useReaderFormSheetBottomInset,
} from "@/components/toolbarItems/readerFormSheetLayout"
import { getOpenableFormats, useOpenBook } from "@/hooks/useOpenBook"
import { shouldAutoplay } from "@/lib/openOptions"
import { formatChoices, sheetTitle } from "@/lib/pileOpen"
import { useGetBookQuery } from "@/store/localApi"
import { type UUID } from "@/uuid"

/**
 * Small sheet shown when a book is opened from a pile and it can be read or
 * listened to. The pick is remembered per book (openFormat saves lastFormat).
 */
export default function ReadOrListenScreen() {
  const { uuid } = useGlobalSearchParams<{ uuid?: UUID }>()
  const router = useRouter()
  const bottomInset = useReaderFormSheetBottomInset()
  const { openFormat } = useOpenBook()
  const { data: book } = useGetBookQuery(
    { uuid: uuid as UUID },
    { skip: !uuid },
  )

  const choices = book ? formatChoices(getOpenableFormats(book)) : []

  return (
    <View
      className="bg-background overflow-hidden"
      style={{ marginBottom: -bottomInset, paddingBottom: bottomInset }}
    >
      <View
        className="items-center justify-center"
        style={{ height: readerFormSheetGrabberHeight }}
      >
        <View className="bg-muted-foreground/40 h-1 w-12 rounded-full" />
      </View>
      <View className="gap-3 px-5 pb-2">
        <View className="gap-0.5">
          <Text className="text-lg font-semibold">{sheetTitle(choices)}</Text>
          {book && (
            <Text className="text-muted-foreground text-sm" numberOfLines={1}>
              {book.title}
            </Text>
          )}
        </View>
        {choices.map((choice) => (
          <Button
            key={choice.format}
            variant={choice.format === "audiobook" ? "secondary" : "default"}
            onPress={() => {
              if (!book) return
              openFormat(book, choice.format, {
                autoplay: shouldAutoplay(choice.format),
                replace: true,
              })
            }}
          >
            <Text>{choice.label}</Text>
          </Button>
        ))}
        <Button variant="ghost" onPress={() => router.back()}>
          <Text>Cancel</Text>
        </Button>
      </View>
      <View style={{ height: readerFormSheetBottomPadding }} />
    </View>
  )
}
