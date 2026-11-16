import { Check } from "lucide-react-native"
import { Pressable, View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { useAvailableFormats } from "@/hooks/useAvailableFormats"
import { useDownloadedFormats } from "@/hooks/useDownloadedFormats"
import {
  canSyncToDrive,
  driveSelection,
  useDriveSelection,
  useDelivery,
} from "@/hooks/useDrive"
import { useOpenBook } from "@/hooks/useOpenBook"
import { useLibraryLook } from "@/lib/libraryLook"
import { tiltStyle } from "@/lib/tilt"
import {
  useDeleteBookMutation,
  useDownloadBookMutation,
  useListStatusesQuery,
  useUpdateStatusMutation,
} from "@/store/localApi"

import { BookCover } from "./BookCover"
import { DownloadingIndicator } from "./DownloadingIndicator"
import { Icon } from "./ui/icon"
import { Menu, type MenuAction } from "./ui/menu"
import { Text } from "./ui/text"

const DEFAULT_THUMBNAIL_WIDTH = 116
const THUMBNAIL_HEIGHT_RATIO = 3 / 2

interface Props {
  book: BookWithRelations
  width?: number
  /** Show a thin progress bar under the cover (only while titles are shown). */
  showProgress?: boolean
  /** Long press starts selecting books for Google Drive (when it is set up). */
  selectable?: boolean
}

export function BookThumbnail({
  book,
  width = DEFAULT_THUMBNAIL_WIDTH,
  showProgress = false,
  selectable = false,
}: Props) {
  const { openBook, openDetails, openFormat } = useOpenBook()
  const [{ showTitles, tilt }] = useLibraryLook()
  const height = Math.round(width * THUMBNAIL_HEIGHT_RATIO)
  const titleFontSize = Math.max(11, Math.min(16, Math.round(width * 0.11)))
  const authorFontSize = Math.max(10, Math.min(14, Math.round(width * 0.1)))

  const downloadedFormats = useDownloadedFormats(book)
  const availableFormats = useAvailableFormats(book)

  const [downloadBook] = useDownloadBookMutation()
  const [deleteBook] = useDeleteBookMutation()

  const delivery = useDelivery()
  const selection = useDriveSelection()
  const selectionActive = selection.size > 0
  const driveSelectable =
    selectable &&
    canSyncToDrive(book) &&
    (delivery.get(book.serverUuid)?.drive === true ||
      delivery.get(book.serverUuid)?.kindle === true)
  const selected = selection.has(book.uuid)

  const { data: statuses } = useListStatusesQuery()

  const [updateStatus] = useUpdateStatusMutation()
  function openBookDetails() {
    openDetails(book)
  }

  const statusActions: MenuAction[] =
    statuses
      ?.filter((status) => status.uuid !== book.status?.uuid)
      .map((status) => ({
        id: `status-${status.uuid}`,
        title: `Move to "${status.name}"`,
        onPress: () => {
          updateStatus({
            bookUuid: book.uuid,
            statusUuid: status.uuid,
          })
        },
      })) ?? []

  const menuActions: MenuAction[] = [
    {
      id: "book-details",
      title: "Book details",
      onPress: openBookDetails,
    },
    ...(downloadedFormats.includes("readaloud") ||
    downloadedFormats.includes("ebook")
      ? [
          {
            id: "open-book",
            title: "Open book",
            onPress: () => {
              openFormat(
                book,
                downloadedFormats.includes("readaloud") ? "readaloud" : "ebook",
              )
            },
          },
        ]
      : []),
    ...(downloadedFormats.includes("audiobook")
      ? [
          {
            id: "play-audiobook",
            title: "Play audiobook",
            onPress: () => {
              openFormat(book, "audiobook")
            },
          },
        ]
      : []),
    ...(statusActions.length
      ? [
          {
            id: "reading-status",
            title: "Reading status",
            subactions: statusActions,
          },
        ]
      : []),
    ...(availableFormats.length
      ? [
          {
            id: "downloads",
            title: "Downloads",
            subactions: availableFormats.map((format) => {
              const isDownloaded = downloadedFormats.includes(format)
              const unavailable =
                format !== "readaloud" &&
                downloadedFormats.includes("readaloud")

              return {
                id: `download-${format}`,
                title: isDownloaded
                  ? `Remove ${format}`
                  : `${format[0]?.toUpperCase()}${format.slice(1)}`,
                ...(isDownloaded
                  ? { attributes: { destructive: true } }
                  : unavailable
                    ? { attributes: { disabled: true } }
                    : {}),
                onPress: () => {
                  if (unavailable) return

                  if (isDownloaded) {
                    deleteBook({
                      bookUuid: book.uuid,
                      format,
                      deleteRecord: book.serverUuid === null,
                    })
                    return
                  }
                  downloadBook({
                    bookUuid: book.uuid,
                    format,
                  })
                },
              }
            }),
          },
        ]
      : []),
  ]

  const downloadingFormat = [book.readaloud, book.ebook, book.audiobook].find(
    (format) => format?.downloadStatus === "DOWNLOADING",
  )
  const progression = book.position?.locator.locations?.totalProgression
  const percent =
    showProgress && typeof progression === "number"
      ? Math.round(progression * 100)
      : null

  const tile = (
    <Pressable
      // With titles off this label is how a screen reader hears the book.
      accessibilityLabel={`Open ${book.title}`}
      accessibilityRole="button"
      accessibilityState={selectionActive ? { selected } : {}}
      // This handler must stay set while selecting. When a long press ends,
      // React Native only skips the follow-up tap if a long press handler is
      // still attached. Removing it once selection starts made the finger lift
      // count as a tap, which un-selected the book and closed selection.
      onLongPress={
        driveSelectable
          ? () =>
              selectionActive
                ? driveSelection.toggle(book)
                : driveSelection.start(book)
          : undefined
      }
      onPress={() => {
        if (selectionActive) {
          driveSelection.toggle(book)
          return
        }
        openBook(book)
      }}
      style={{ width }}
    >
      {/* Only the cover leans. A picked book straightens so it stands out. */}
      <View
        style={tiltStyle(
          book.uuid,
          tilt,
          selectionActive && driveSelectable && selected,
        )}
      >
        <BookCover book={book} height={height} width={width} />
      </View>
      {downloadingFormat && (
        <DownloadingIndicator
          className="absolute z-50"
          progress={downloadingFormat.downloadProgress}
          size={Math.ceil(height / 10)}
          style={{ right: 6, top: 6 }}
        />
      )}
      {selectionActive && driveSelectable && (
        <View
          className={
            selected
              ? "bg-primary border-primary absolute z-50 size-6 items-center justify-center rounded-full border-2"
              : "border-primary absolute z-50 size-6 items-center justify-center rounded-full border-2 bg-black/40"
          }
          style={{ right: 6, top: 6 }}
        >
          {selected && (
            <Icon as={Check} size={14} className="text-primary-foreground" />
          )}
        </View>
      )}
      {showTitles && percent !== null && (
        <View className="bg-secondary mt-3 h-1 overflow-hidden rounded-full">
          <View
            className="bg-primary h-full"
            style={{ width: `${percent}%` }}
          />
        </View>
      )}
      {showTitles && (
        <>
          <Text
            className="mt-3 font-semibold"
            numberOfLines={2}
            style={{
              fontSize: titleFontSize,
              lineHeight: titleFontSize + 4,
              maxWidth: width,
            }}
          >
            {book.title}
          </Text>
          <Text
            className="text-muted-foreground mt-0.5"
            numberOfLines={1}
            style={{ fontSize: authorFontSize, maxWidth: width }}
          >
            {book.authors[0]?.name}
          </Text>
        </>
      )}
    </Pressable>
  )

  return (
    <View style={{ width }}>
      {driveSelectable ? (
        tile
      ) : (
        <Menu actions={menuActions} shouldOpenOnLongPress>
          {tile}
        </Menu>
      )}
    </View>
  )
}
