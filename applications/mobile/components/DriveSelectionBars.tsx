import { Check, X } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { Alert, Pressable, View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import {
  driveSelection,
  useDelivery,
  useDriveSelection,
  useKindleSentSet,
  useSendToKindle,
  useSyncToDrive,
} from "@/hooks/useDrive"
import { useIsFocused } from "@/hooks/useIsFocused"
import {
  describeActionScope,
  kindleButtonLabel,
  kindleProgressLabel,
  kindleResendState,
  selectKindleBooks,
  splitByServers,
} from "@/lib/kindleSend"

import { Button } from "./ui/button"
import { Icon } from "./ui/icon"
import { Text } from "./ui/text"

function kindleServersOf(delivery: ReturnType<typeof useDelivery>) {
  return new Set(
    [...delivery].filter(([, info]) => info.kindle).map(([uuid]) => uuid),
  )
}

function CheckRow({
  checked,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean
  label: string
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      className="flex-row items-center gap-3"
      disabled={disabled}
      onPress={onToggle}
    >
      <View
        className={
          checked
            ? "bg-primary border-primary size-6 items-center justify-center rounded-md border-2"
            : "border-border size-6 items-center justify-center rounded-md border-2"
        }
      >
        {checked && (
          <Icon as={Check} size={16} className="text-primary-foreground" />
        )}
      </View>
      <Text className="text-sm">{label}</Text>
    </Pressable>
  )
}

interface Props {
  /** The books on this screen, used by "Select all". */
  books: readonly BookWithRelations[]
}

/** Top and bottom bars shown while books are selected for Google Drive. */
export function DriveSelectionBars({ books }: Props) {
  const selection = useDriveSelection()
  const isFocused = useIsFocused()
  const syncToDrive = useSyncToDrive()
  const sendToKindle = useSendToKindle()
  const delivery = useDelivery()
  const [overwrite, setOverwrite] = useState(false)
  const [resendChoice, setResendChoice] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const copying = busy !== null

  useEffect(() => () => driveSelection.clear(), [])

  const count = selection.size
  const selected = useMemo(() => [...selection.values()], [selection])
  const kindleSent = useKindleSentSet(
    useMemo(
      () =>
        isFocused
          ? selected.filter((book) =>
              kindleServersOf(delivery).has(book.serverUuid),
            )
          : [],
      [isFocused, selected, delivery],
    ),
  )
  if (!isFocused || count === 0) return null

  const driveServers = new Set(
    [...delivery].filter(([, info]) => info.drive).map(([uuid]) => uuid),
  )
  const kindleServers = kindleServersOf(delivery)
  const drive = splitByServers(selected, driveServers)
  const kindle = splitByServers(selected, kindleServers)
  const resendState = kindleResendState(
    kindle.included.map((book) => book.uuid),
    kindleSent,
  )
  const resend = resendChoice ?? resendState.defaultResend
  const kindleBooks = selectKindleBooks(kindle.included, kindleSent, resend)
  const kindleLabel = kindleButtonLabel(kindleBooks.length, resend)

  function confirm(
    title: string,
    action: string,
    split: { included: typeof selected; excluded: typeof selected },
    work: (books: typeof selected) => Promise<{ ok: boolean; message: string }>,
    failTitle: string,
  ) {
    Alert.alert(
      title,
      describeActionScope(action, split.included.length, split.excluded.length),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action,
          onPress: () => {
            void (async () => {
              setBusy(title)
              setProgress(0)
              const outcome = await work(split.included)
              setBusy(null)
              Alert.alert(outcome.ok ? title : failTitle, outcome.message)
              if (outcome.ok) driveSelection.clear()
            })()
          },
        },
      ],
    )
  }

  const runDrive = () =>
    confirm(
      "Google Drive",
      "Sync",
      drive,
      (books) => syncToDrive(books, overwrite, setProgress),
      "Could not copy",
    )
  const runKindle = () =>
    confirm(
      "Send to Kindle",
      kindleLabel.action,
      { included: kindleBooks, excluded: kindle.excluded },
      (books) => sendToKindle(books, setProgress),
      "Could not send",
    )

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
        {drive.included.length > 0 && (
          <>
            <CheckRow
              checked={overwrite}
              label="Replace files already in Drive"
              disabled={copying}
              onToggle={() => setOverwrite(!overwrite)}
            />
            <Button
              size="lg"
              className="rounded-full"
              accessibilityLabel={`Sync ${drive.included.length} to Drive`}
              disabled={copying}
              onPress={runDrive}
            >
              <Text className="text-primary-foreground">
                {busy === "Google Drive"
                  ? `Copying ${progress} of ${drive.included.length}`
                  : `Sync ${drive.included.length} to Drive`}
              </Text>
            </Button>
          </>
        )}
        {kindle.included.length > 0 && (
          <>
            {resendState.showCheckbox && (
              <CheckRow
                checked={resend}
                label="Also resend books already sent"
                disabled={copying}
                onToggle={() => setResendChoice(!resend)}
              />
            )}
            <Button
              size="lg"
              className="rounded-full"
              accessibilityLabel={kindleLabel.button}
              disabled={copying || kindleBooks.length === 0}
              onPress={runKindle}
            >
              <Text className="text-primary-foreground">
                {busy === "Send to Kindle"
                  ? kindleProgressLabel(progress, kindleBooks.length)
                  : kindleLabel.button}
              </Text>
            </Button>
          </>
        )}
      </View>
    </>
  )
}
