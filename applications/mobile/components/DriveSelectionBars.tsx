import { Check, X } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Alert, Pressable, View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import {
  driveSelection,
  useDriveSelection,
  useSyncToDrive,
} from "@/hooks/useDrive"
import { useIsFocused } from "@/hooks/useIsFocused"

import { Button } from "./ui/button"
import { Icon } from "./ui/icon"
import { Text } from "./ui/text"

interface Props {
  /** The books on this screen, used by "Select all". */
  books: readonly BookWithRelations[]
}

/** Top and bottom bars shown while books are selected for Google Drive. */
export function DriveSelectionBars({ books }: Props) {
  const selection = useDriveSelection()
  const isFocused = useIsFocused()
  const syncToDrive = useSyncToDrive()
  const [overwrite, setOverwrite] = useState(false)
  const [copying, setCopying] = useState(false)

  useEffect(() => () => driveSelection.clear(), [])

  const count = selection.size
  if (!isFocused || count === 0) return null

  const noun = count === 1 ? "book" : "books"

  async function run() {
    const selected = [...selection.values()]
    setCopying(true)
    const outcome = await syncToDrive(selected, overwrite)
    setCopying(false)
    Alert.alert(outcome.ok ? "Google Drive" : "Could not copy", outcome.message)
    if (outcome.ok) driveSelection.clear()
  }

  return (
    <>
      <View className="bg-background border-border pt-safe absolute top-0 right-0 left-0 z-50 border-b">
        <View className="px-safe-or-2 flex-row items-center gap-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel="Exit selection"
            disabled={copying}
            onPress={() => driveSelection.clear()}
          >
            <Icon as={X} size={22} />
          </Button>
          <Text className="flex-1 text-base font-semibold">
            {count} selected
          </Text>
          <Button
            variant="ghost"
            accessibilityLabel="Select all books"
            disabled={copying}
            onPress={() => driveSelection.selectAll(books)}
          >
            <Text className="text-primary">Select all</Text>
          </Button>
        </View>
      </View>
      <View className="bg-background border-border pb-safe px-safe-or-4 absolute right-0 bottom-0 left-0 z-50 gap-3 border-t pt-3">
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: overwrite }}
          accessibilityLabel="Replace files already in Drive"
          className="flex-row items-center gap-3"
          disabled={copying}
          onPress={() => setOverwrite(!overwrite)}
        >
          <View
            className={
              overwrite
                ? "bg-primary border-primary size-6 items-center justify-center rounded-md border-2"
                : "border-border size-6 items-center justify-center rounded-md border-2"
            }
          >
            {overwrite && (
              <Icon as={Check} size={16} className="text-primary-foreground" />
            )}
          </View>
          <Text className="text-sm">Replace files already in Drive</Text>
        </Pressable>
        <Button
          size="lg"
          className="rounded-full"
          accessibilityLabel={`Sync ${count} to Drive`}
          disabled={copying}
          onPress={() => void run()}
        >
          <Text className="text-primary-foreground">
            {copying ? `Copying ${count} ${noun}...` : `Sync ${count} to Drive`}
          </Text>
        </Button>
      </View>
    </>
  )
}
