import { CloudUpload } from "lucide-react-native"
import { useState } from "react"
import { Alert, View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { useDriveAvailable } from "@/hooks/useDrive"
import { describeSyncedAt, driveErrorMessage } from "@/lib/driveSync"
import {
  type DriveSyncResult,
  useListDriveBooksQuery,
  useSyncBooksToDriveMutation,
} from "@/store/serverApi"

import { Button } from "./ui/button"
import { Icon } from "./ui/icon"
import { Text } from "./ui/text"

const DRIVE_GREEN = "#4ade80"

/** "Google Drive" card on the book page. Hidden unless Drive is connected. */
export function DriveCard({ book }: { book: BookWithRelations }) {
  const available = useDriveAvailable(book)
  const serverUuid = book.serverUuid

  const { data: files } = useListDriveBooksQuery(
    { serverUuid: serverUuid!, books: [book.uuid] },
    { skip: !available || !serverUuid },
  )
  const [sync, { isLoading }] = useSyncBooksToDriveMutation()
  const [justSynced, setJustSynced] = useState<string | null>(null)

  if (!available || !serverUuid) return null

  const syncedAt = justSynced ?? files?.[book.uuid]?.syncedAt ?? null
  const onDrive = syncedAt !== null

  async function run(overwrite: boolean) {
    try {
      const response = await sync({
        serverUuid: serverUuid!,
        books: [book.uuid],
        overwrite,
      }).unwrap()
      const result: DriveSyncResult | undefined = response.results[0]
      if (!result || result.status === "failed") {
        Alert.alert(
          "Could not copy",
          result?.message ?? "Could not copy this book to Drive",
        )
        return
      }
      setJustSynced(new Date().toISOString())
    } catch (error) {
      Alert.alert("Could not copy", driveErrorMessage(error))
    }
  }

  return (
    <View className="bg-card border-border mb-4 gap-3 self-stretch rounded-xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={CloudUpload} size={24} className="text-primary" />
        <View className="flex-1">
          <Text className="font-semibold">Google Drive</Text>
          <Text className="text-muted-foreground text-xs">
            Folder: Rakuten Kobo
          </Text>
        </View>
      </View>
      {isLoading ? (
        <Button
          variant="outline"
          disabled
          className="border-primary rounded-full"
        >
          <Text className="text-primary">Copying to Drive...</Text>
        </Button>
      ) : onDrive ? (
        <View className="flex-row items-center justify-between gap-3">
          <View>
            <Text className="font-semibold" style={{ color: DRIVE_GREEN }}>
              On Drive
            </Text>
            <Text className="text-muted-foreground text-xs">
              {describeSyncedAt(syncedAt)}
            </Text>
          </View>
          <Button
            variant="outline"
            size="sm"
            className="border-primary rounded-full"
            accessibilityLabel="Sync again and overwrite the file on Drive"
            onPress={() => void run(true)}
          >
            <Text className="text-primary text-xs">Sync again (overwrite)</Text>
          </Button>
        </View>
      ) : (
        <Button
          variant="outline"
          className="border-primary rounded-full"
          accessibilityLabel="Sync to Drive"
          onPress={() => void run(false)}
        >
          <Text className="text-primary">Sync to Drive</Text>
        </Button>
      )}
    </View>
  )
}
