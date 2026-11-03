import { Pressable, View } from "react-native"

import { type BookWithRelations } from "@/database/books"
import { useAvailableFormats } from "@/hooks/useAvailableFormats"
import { useDownloadedFormats } from "@/hooks/useDownloadedFormats"
import { useOpenBook } from "@/hooks/useOpenBook"
import {
  useDeleteBookMutation,
  useDownloadBookMutation,
  useListStatusesQuery,
  useUpdateStatusMutation,
} from "@/store/localApi"

import { BookCover } from "./BookCover"
import { DownloadingIndicator } from "./DownloadingIndicator"
import { Menu, type MenuAction } from "./ui/menu"
import { Text } from "./ui/text"

const DEFAULT_THUMBNAIL_WIDTH = 116
const THUMBNAIL_HEIGHT_RATIO = 3 / 2

interface Props {
  book: BookWithRelations
  width?: number
  /** Show a thin progress line and percent under the cover. */
  showProgress?: boolean
}

export function BookThumbnail({
  book,
  width = DEFAULT_THUMBNAIL_WIDTH,
  showProgress = false,
}: Props) {
  const { openBook, openDetails, openFormat } = useOpenBook()
  const height = Math.round(width * THUMBNAIL_HEIGHT_RATIO)
  const titleFontSize = Math.max(11, Math.min(16, Math.round(width * 0.11)))
  const authorFontSize = Math.max(10, Math.min(14, Math.round(width * 0.1)))

  const downloadedFormats = useDownloadedFormats(book)
  const availableFormats = useAvailableFormats(book)

  const [downloadBook] = useDownloadBookMutation()
  const [deleteBook] = useDeleteBookMutation()

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

  return (
    <View style={{ width }}>
      <Menu actions={menuActions} shouldOpenOnLongPress>
        <Pressable
          accessibilityLabel={`Open ${book.title}`}
          accessibilityRole="button"
          onPress={() => openBook(book)}
          style={{ width }}
        >
          <BookCover book={book} height={height} width={width} />
          {downloadingFormat && (
            <DownloadingIndicator
              className="absolute z-50"
              progress={downloadingFormat.downloadProgress}
              size={Math.ceil(height / 10)}
              style={{ right: 6, top: 6 }}
            />
          )}
          {percent !== null && (
            <View className="bg-secondary mt-3 h-1 overflow-hidden rounded-full">
              <View
                className="bg-primary h-full"
                style={{ width: `${percent}%` }}
              />
            </View>
          )}
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
        </Pressable>
      </Menu>
    </View>
  )
}
