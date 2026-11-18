import { Check, Send } from "lucide-react-native"
import { useState } from "react"
import { Alert, View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { useBookDelivery } from "@/hooks/useDrive"
import { describeSentAt, kindleErrorMessage } from "@/lib/kindleSend"
import {
  useListKindleSentQuery,
  useSendBooksToKindleMutation,
} from "@/store/serverApi"

import { Button } from "./ui/button"
import { Icon } from "./ui/icon"
import { Text } from "./ui/text"

const SENT_GREEN = "#4ade80"

/** "Send to Kindle" card on the book page. Hidden unless Kindle is set up. */
export function KindleCard({ book }: { book: BookWithRelations }) {
  const { kindle, kindleAddress } = useBookDelivery(book)
  const serverUuid = book.serverUuid
  const [send, { isLoading }] = useSendBooksToKindleMutation()
  const [justSent, setJustSent] = useState<string | null>(null)
  const { data: records } = useListKindleSentQuery(
    { serverUuid: serverUuid!, books: [book.uuid] },
    { skip: !kindle || !serverUuid },
  )

  if (!kindle || !serverUuid) return null

  const sentAt = justSent ?? records?.[book.uuid]?.sentAt ?? null
  const sent = sentAt !== null

  async function run() {
    try {
      await send({ serverUuid: serverUuid!, books: [book.uuid] }).unwrap()
      setJustSent(new Date().toISOString())
    } catch (error) {
      Alert.alert("Could not send", kindleErrorMessage(error))
    }
  }

  return (
    <View className="bg-card border-border mb-4 gap-3 self-stretch rounded-xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={Send} size={24} className="text-primary" />
        <View className="flex-1">
          <Text className="font-semibold">Send to Kindle</Text>
          {!!kindleAddress && (
            <Text className="text-muted-foreground text-xs">
              To {kindleAddress}
            </Text>
          )}
        </View>
      </View>
      {isLoading ? (
        <Button
          variant="outline"
          disabled
          className="border-primary rounded-full"
        >
          <Text className="text-primary">Sending...</Text>
        </Button>
      ) : sent ? (
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-1.5">
            <Icon as={Check} size={16} color={SENT_GREEN} />
            <Text className="font-semibold" style={{ color: SENT_GREEN }}>
              {describeSentAt(sentAt)}
            </Text>
          </View>
          <Button
            variant="outline"
            size="sm"
            className="border-primary rounded-full"
            accessibilityLabel="Resend to Kindle"
            onPress={() => void run()}
          >
            <Text className="text-primary text-xs">Resend</Text>
          </Button>
        </View>
      ) : (
        <Button
          variant="outline"
          className="border-primary rounded-full"
          accessibilityLabel="Send to Kindle"
          onPress={() => void run()}
        >
          <Text className="text-primary">Send to Kindle</Text>
        </Button>
      )}
    </View>
  )
}
