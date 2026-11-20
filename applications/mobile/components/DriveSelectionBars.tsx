import { useRouter } from "expo-router"
import { Archive, Check, CloudUpload, Plus, Send, X } from "lucide-react-native"
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
import { useArchiveBooks } from "@/hooks/useArchiveBooks"
import { useIsFocused } from "@/hooks/useIsFocused"
import { useToReadActions } from "@/hooks/useToRead"
import { archiveBarLabel, archiveBusyLabel } from "@/lib/archive"
import {
  canAddToRead,
  selectionToReadAction,
  selectionToReadLabel,
  toReadProgressLabel,
} from "@/lib/homeSections"
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
  /**
   * "archive" is the Archive screen: the bar only offers "Move back to
   * library". In the library it offers "Move to Archive" under the other
   * buttons.
   */
  mode?: "library" | "archive"
}

/** Top and bottom bars shown while books are selected for Google Drive. */
export function DriveSelectionBars({ books, mode = "library" }: Props) {
  const selection = useDriveSelection()
  const isFocused = useIsFocused()
  const router = useRouter()
  const syncToDrive = useSyncToDrive()
  const sendToKindle = useSendToKindle()
  const delivery = useDelivery()
  const toRead = useToReadActions()
  const archiveBooks = useArchiveBooks()
  const [overwrite, setOverwrite] = useState(false)
  const [resendChoice, setResendChoice] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const copying = busy !== null

  useEffect(() => () => driveSelection.clear(), [])

  const count = selection.size
  const selected = useMemo(() => [...selection.values()], [selection])
  // Drive and Kindle only take books that have an ebook.
  const sendable = useMemo(
    () => selected.filter((book) => book.sendable),
    [selected],
  )
  const kindleSent = useKindleSentSet(
    useMemo(
      () =>
        isFocused
          ? sendable.filter((book) =>
              kindleServersOf(delivery).has(book.serverUuid),
            )
          : [],
      [isFocused, sendable, delivery],
    ),
  )
  if (!isFocused || count === 0) return null

  const driveServers = new Set(
    [...delivery].filter(([, info]) => info.drive).map(([uuid]) => uuid),
  )
  const kindleServers = kindleServersOf(delivery)
  const drive = splitByServers(sendable, driveServers)
  const kindle = splitByServers(sendable, kindleServers)
  const resendState = kindleResendState(
    kindle.included.map((book) => book.uuid),
    kindleSent,
  )
  const resend = resendChoice ?? resendState.defaultResend
  const kindleBooks = selectKindleBooks(kindle.included, kindleSent, resend)
  const kindleLabel = kindleButtonLabel(kindleBooks.length, resend)

  const toReadAction = selectionToReadAction(
    selected.map((book) => book.statusName),
  )
  const toReadCount =
    toReadAction === "add"
      ? selected.filter((book) => canAddToRead(book.statusName)).length
      : selected.length

  /** Marks the bars busy while `work` runs, then clears the selection if it worked. */
  function runBusy(
    title: string,
    work: () => Promise<{
      ok: boolean
      alert?: { title: string; message: string }
    }>,
  ) {
    void (async () => {
      setBusy(title)
      setProgress(0)
      const result = await work()
      setBusy(null)
      if (result.ok) driveSelection.clear()
      if (result.alert) Alert.alert(result.alert.title, result.alert.message)
    })()
  }

  function runToRead() {
    if (!toReadAction) return
    const action = toReadAction
    runBusy("To Read", async () => {
      try {
        await (action === "add" ? toRead.add : toRead.remove)(
          selected,
          setProgress,
        )
        return { ok: true }
      } catch {
        return {
          ok: false,
          alert: {
            title: "Could not update To Read",
            message:
              action === "remove"
                ? "Removing needs a connection to the server. Try again when you are online."
                : "Something went wrong. Try again.",
          },
        }
      }
    })
  }

  const inArchive = mode === "archive"

  function runArchive() {
    runBusy("Archive", async () => {
      const outcome = await archiveBooks(selected, !inArchive)
      return {
        ok: outcome.ok,
        alert: {
          title: outcome.ok ? "Archive" : "Could not move",
          message: outcome.message,
        },
      }
    })
  }

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
          onPress: () =>
            runBusy(title, async () => {
              const outcome = await work(split.included)
              return {
                ok: outcome.ok,
                alert: {
                  title: outcome.ok ? title : failTitle,
                  message: outcome.message,
                },
              }
            }),
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

  const driveCaption =
    drive.included.length > 0
      ? busy === "Google Drive"
        ? `Copying ${progress} of ${drive.included.length}`
        : `Drive: sync ${drive.included.length}`
      : null
  const kindleCaption =
    kindle.included.length > 0
      ? busy === "Send to Kindle"
        ? kindleProgressLabel(progress, kindleBooks.length)
        : `Kindle: ${kindleLabel.action.toLowerCase()} ${kindleBooks.length}`
      : null
  const caption = [driveCaption, kindleCaption].filter(Boolean).join(". ")

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
        {inArchive ? (
          <Button
            size="lg"
            className="rounded-full"
            accessibilityLabel={archiveBarLabel(true, count)}
            disabled={copying}
            onPress={runArchive}
          >
            <Text className="text-primary-foreground">
              {busy === "Archive"
                ? archiveBusyLabel(true)
                : archiveBarLabel(true, count)}
            </Text>
          </Button>
        ) : (
          <>
            {drive.included.length > 0 && (
              <CheckRow
                checked={overwrite}
                label="Replace files already in Drive"
                disabled={copying}
                onToggle={() => setOverwrite(!overwrite)}
              />
            )}
            {kindle.included.length > 0 && resendState.showCheckbox && (
              <CheckRow
                checked={resend}
                label="Also resend books already sent"
                disabled={copying}
                onToggle={() => setResendChoice(!resend)}
              />
            )}
            {toReadAction && (
              <Button
                size="lg"
                className="rounded-full"
                accessibilityLabel={selectionToReadLabel(
                  toReadAction,
                  toReadCount,
                )}
                disabled={copying}
                onPress={runToRead}
              >
                <Text className="text-primary-foreground">
                  {busy === "To Read"
                    ? toReadProgressLabel(
                        toReadAction,
                        progress,
                        selected.length,
                      )
                    : selectionToReadLabel(toReadAction, toReadCount)}
                </Text>
              </Button>
            )}
            {caption && (
              <Text className="text-muted-foreground text-xs">{caption}</Text>
            )}
            <View className="flex-row items-center gap-2.5">
              {drive.included.length > 0 && (
                <Button
                  size="lg"
                  className="w-[52px] rounded-full px-0"
                  accessibilityLabel="Send to Google Drive"
                  disabled={copying}
                  onPress={runDrive}
                >
                  <Icon
                    as={CloudUpload}
                    size={20}
                    className="text-primary-foreground"
                  />
                </Button>
              )}
              {kindle.included.length > 0 && (
                <Button
                  size="lg"
                  className="w-[52px] rounded-full px-0"
                  accessibilityLabel="Send to Kindle"
                  disabled={copying || kindleBooks.length === 0}
                  onPress={runKindle}
                >
                  <Icon
                    as={Send}
                    size={20}
                    className="text-primary-foreground"
                  />
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="flex-1 rounded-full"
                accessibilityLabel="Add to collection"
                disabled={copying}
                onPress={() => router.push("/add-to-collection")}
              >
                <Icon as={Plus} size={18} />
                <Text>Add to collection</Text>
              </Button>
            </View>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full"
              accessibilityLabel={archiveBarLabel(false, count)}
              disabled={copying}
              onPress={runArchive}
            >
              <Icon as={Archive} size={18} />
              <Text>
                {busy === "Archive"
                  ? archiveBusyLabel(false)
                  : archiveBarLabel(false, count)}
              </Text>
            </Button>
          </>
        )}
      </View>
    </>
  )
}
