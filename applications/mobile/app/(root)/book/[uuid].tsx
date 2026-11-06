import { Link, useLocalSearchParams, useRouter } from "expo-router"
import {
  ChevronDown,
  ChevronLeft,
  BookOpen,
  ChevronRight,
  CircleX,
  Download,
  Headphones,
  Heart,
  Star,
  Trash2,
  LibraryBig,
  LibrarySquare,
  Tag,
} from "lucide-react-native"
import { Fragment, useState } from "react"
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native"
import { AnimatedCircularProgress } from "react-native-circular-progress"
import { useCSSVariable } from "uniwind"

import { BackButton } from "@/components/BackButton"
import BookDescription from "@/components/BookDescription"
import { BookCover } from "@/components/BookCover"
import { BookNotes } from "@/components/BookNotes"
import { LoadingView } from "@/components/LoadingView"
import { MiniPlayerWidget } from "@/components/MiniPlayerWidget"
import { ScreenBackButton } from "@/components/ScreenBackButton"
import { Group } from "@/components/ui/Group"
import { Stack } from "@/components/ui/Stack"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Menu } from "@/components/ui/menu"
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Text } from "@/components/ui/text"
import { useAvailableFormats } from "@/hooks/useAvailableFormats"
import { useColorTheme } from "@/hooks/useColorTheme"
import { useDownloadedFormats } from "@/hooks/useDownloadedFormats"
import { useListAllServerBooks } from "@/hooks/useListAllServerBooks"
import { pickFormat, useOpenBook } from "@/hooks/useOpenBook"
import { useBookPrefs } from "@/lib/bookPrefs"
import { useBookPrefActions } from "@/lib/bookPrefsSync"
import { useOpenLibraryExcerpt } from "@/lib/openLibrary"
import { usesSystemHeader } from "@/lib/nativeChrome"
import {
  useCancelDownloadMutation,
  useDeleteBookMutation,
  useDownloadBookMutation,
  useGetBookQuery,
  useListStatusesQuery,
  useUpdateStatusMutation,
} from "@/store/localApi"
import { useLazyGetBookQuery as useLazyGetServerBookQuery } from "@/store/serverApi"
import type { UUID } from "@/uuid"

export default function BookDetailsScreen() {
  const router = useRouter()
  const { uuid } = useLocalSearchParams() as { uuid: UUID }
  const { foreground } = useColorTheme()

  const [downloadBook] = useDownloadBookMutation()
  const [cancelDownload] = useCancelDownloadMutation()
  const [deleteBook] = useDeleteBookMutation()
  const { data: book, isLoading, isUninitialized } = useGetBookQuery({ uuid })

  const { data: statuses } = useListStatusesQuery()

  const [updateStatus] = useUpdateStatusMutation()

  const [getServerBook, { isLoading: isServerLoading }] =
    useLazyGetServerBookQuery()

  const [showTagsMore, setShowTagsMore] = useState(false)
  const [showCollectionsMore, setShowCollectionsMore] = useState(false)
  const [pendingDeleteFormat, setPendingDeleteFormat] = useState<
    "readaloud" | "ebook" | "audiobook" | null
  >(null)

  const downloadedFormats = useDownloadedFormats(book)

  const availableFormats = useAvailableFormats(book)
  const onlyFormat = availableFormats[0]

  const { refetch } = useListAllServerBooks()
  const { openFormat } = useOpenBook()
  const { width: windowWidth } = useWindowDimensions()
  const prefs = useBookPrefs(book?.uuid)
  const prefActions = useBookPrefActions()
  const onPrimary = useCSSVariable("--color-primary-foreground") as string
  const primary = useCSSVariable("--color-primary") as string
  const excerpt = useOpenLibraryExcerpt(
    uuid,
    book?.title ?? "",
    book?.authors[0]?.name,
  )

  if (isLoading || isUninitialized) return <LoadingView />

  if (!book) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Book not found</Text>
        <Button
          accessibilityLabel="Go back"
          onPress={() => {
            if (router.canGoBack()) {
              router.back()
            } else {
              router.replace("/")
            }
          }}
        >
          <Text>Go back</Text>
        </Button>
      </View>
    )
  }

  const openableFormat = pickFormat(book)
  const downloadingFormat = [book.readaloud, book.ebook, book.audiobook].find(
    (format) => format?.downloadStatus === "DOWNLOADING",
  )

  const numberOfTagsToShow = 6
  const tagsMoreNeeded = book.tags.length > numberOfTagsToShow
  const tagsToShow = showTagsMore
    ? book.tags
    : book.tags.slice(0, numberOfTagsToShow)
  const numTagsHidden = book.tags.length - tagsToShow.length

  const numberOfCollectionsToShow = 6
  const collectionsMoreNeeded =
    book.collections.length > numberOfCollectionsToShow
  const collectionsToShow = showCollectionsMore
    ? book.collections
    : book.collections.slice(0, numberOfCollectionsToShow)
  const numCollectionsHidden =
    book.collections.length - collectionsToShow.length

  return (
    <View className="flex-1">
      {/* Contributes header options, it does not render a view. */}
      <ScreenBackButton />
      <ScrollView
        contentInsetAdjustmentBehavior={
          usesSystemHeader ? "automatic" : "never"
        }
        refreshControl={
          book.serverUuid ? (
            <RefreshControl
              refreshing={isServerLoading}
              onRefresh={() => {
                getServerBook({
                  serverUuid: book.serverUuid!,
                  bookUuid: book.uuid,
                })
              }}
            />
          ) : undefined
        }
      >
        <Stack className={usesSystemHeader ? "" : "pt-safe"}>
          {!usesSystemHeader && (
            <View className="px-safe-or-2 flex-row justify-between">
              <BackButton />
            </View>
          )}
          <Pressable
            accessibilityLabel={
              openableFormat ? `Open ${book.title}` : `Download ${book.title}`
            }
            accessibilityRole="button"
            onPress={() => {
              if (downloadingFormat) return
              if (openableFormat) {
                openFormat(book, openableFormat)
              } else if (onlyFormat) {
                downloadBook({ bookUuid: book.uuid, format: onlyFormat })
              }
            }}
          >
            <BookCover
              badge={false}
              book={book}
              keepSlot={false}
              className="rounded-none border-0"
              height={Math.min(Math.round(windowWidth * 1.25), 520)}
              width={windowWidth}
            />
            <View className="bg-primary absolute right-4 bottom-4 size-14 items-center justify-center rounded-full">
              {downloadingFormat && (
                <View className="absolute">
                  <AnimatedCircularProgress
                    backgroundColor={onPrimary + "44"}
                    fill={downloadingFormat.downloadProgress}
                    rotation={0}
                    size={48}
                    tintColor={onPrimary}
                    width={3}
                  />
                </View>
              )}
              <Icon
                as={
                  downloadingFormat || !openableFormat
                    ? Download
                    : openableFormat === "audiobook"
                      ? Headphones
                      : BookOpen
                }
                className="text-primary-foreground"
                size={downloadingFormat ? 20 : 24}
              />
            </View>
          </Pressable>
          <Stack className="px-safe-or-8 items-start">
            <Text className="mt-5 mb-1 text-2xl" variant="h1">
              {book.title}
            </Text>
            {book.subtitle && (
              <Text className="mb-4 text-base italic">{book.subtitle}</Text>
            )}
            <Stack className="mb-4 gap-1 pl-0">
              <Group>
                <Text className="text-muted-foreground text-sm">
                  by{" "}
                  {book.authors.map((author, index) => (
                    <Fragment key={author.uuid}>
                      <Link
                        href={{
                          pathname: "/author/[uuid]",
                          params: {
                            uuid: author.uuid,
                          },
                        }}
                        className="active:text-primary active:underline"
                      >
                        <Text className="text-primary text-sm">
                          {author.name}
                        </Text>
                      </Link>
                      <Text className="text-sm">
                        {index < book.authors.length - 1 && ", "}
                      </Text>
                    </Fragment>
                  ))}
                </Text>
              </Group>
              {!!book.narrators.length && (
                <Text className="text-muted-foreground text-sm">
                  narrated by{" "}
                  {book.narrators.map((narrator, index) => (
                    <Fragment key={narrator.uuid}>
                      <Link
                        href={{
                          pathname: "/narrator/[uuid]",
                          params: {
                            uuid: narrator.uuid,
                          },
                        }}
                        className="active:text-primary active:underline"
                      >
                        <Text className="text-primary text-sm">
                          {narrator.name}
                        </Text>
                      </Link>
                      <Text className="text-sm">
                        {index < book.narrators.length - 1 && ", "}
                      </Text>
                    </Fragment>
                  ))}
                </Text>
              )}
            </Stack>
            <View className="mb-4 flex-row items-center gap-2 self-stretch">
              <View className="bg-secondary h-10 flex-row items-center rounded-xl px-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    accessibilityLabel={`Rate ${star} out of 5`}
                    accessibilityRole="button"
                    className="size-8 items-center justify-center"
                    onPress={() =>
                      void prefActions.setRating(
                        book,
                        prefs.rating === star ? 0 : star,
                      )
                    }
                  >
                    <Icon
                      as={Star}
                      className="text-primary"
                      fill={(prefs.rating ?? 0) >= star ? primary : "none"}
                      size={18}
                    />
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityLabel={
                  prefs.favourite
                    ? "Remove from favourites"
                    : "Add to favourites"
                }
                accessibilityRole="button"
                className="bg-secondary size-10 items-center justify-center rounded-xl"
                onPress={() =>
                  void prefActions.setFavourite(book, !prefs.favourite)
                }
              >
                <Icon
                  as={Heart}
                  className="text-primary"
                  fill={prefs.favourite ? primary : "none"}
                  size={20}
                />
              </Pressable>
            </View>
            <BookNotes
              review={prefs.review ?? ""}
              onSave={(review) => void prefActions.setReview(book, review)}
            />
            <Group className="mb-4 items-center justify-between self-stretch">
              {book.status && (
                <Select
                  value={{
                    value: book.status.uuid,
                    label: book.status.name,
                  }}
                  onValueChange={(option) => {
                    if (!option) return
                    updateStatus({
                      bookUuid: book.uuid,
                      statusUuid: option.value as UUID,
                    })
                  }}
                >
                  <SelectTrigger
                    accessibilityLabel={`Reading status, ${book.status.name}`}
                  >
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  {statuses?.map((status) => (
                    <SelectItem
                      key={status.uuid}
                      label={status.name}
                      value={status.uuid}
                    />
                  ))}
                </Select>
              )}
              <Stack className="gap-1">
                <Group className="self-end rounded-md px-2 py-[0.05rem]">
                  {availableFormats.length > 1 ? (
                    <Menu
                      actions={availableFormats.map((format) => {
                        const status = book[format]?.downloadStatus
                        const isActiveDownload =
                          status === "DOWNLOADING" || status === "QUEUED"
                        const isDownloaded = downloadedFormats.includes(format)
                        const unavailable =
                          format !== "readaloud" &&
                          downloadedFormats.includes("readaloud")
                        const label = isDownloaded
                          ? `Remove ${format}`
                          : isActiveDownload
                            ? `Cancel ${format} download`
                            : `Download ${format}`

                        return {
                          id: `download-${format}`,
                          title: label,
                          ...(isDownloaded
                            ? { attributes: { destructive: true } }
                            : unavailable
                              ? { attributes: { disabled: true } }
                              : {}),
                          onPress: () => {
                            if (unavailable) return

                            if (isActiveDownload) {
                              cancelDownload({
                                bookUuid: book.uuid,
                                format,
                              })
                              return
                            }

                            if (isDownloaded) {
                              setPendingDeleteFormat(format)
                              return
                            }
                            downloadBook({
                              bookUuid: book.uuid,
                              format,
                            })
                          },
                        }
                      })}
                    >
                      <Button
                        variant="default"
                        accessibilityLabel="Open download options"
                      >
                        <Text>Downloads</Text>
                        <Icon
                          as={ChevronDown}
                          size={16}
                          className="text-primary-foreground"
                        />
                      </Button>
                    </Menu>
                  ) : (
                    onlyFormat && (
                      <>
                        <Button
                          variant={
                            book[onlyFormat]?.downloadStatus === "DOWNLOADED" ||
                            book[onlyFormat]?.downloadStatus ===
                              "DOWNLOADING" ||
                            book[onlyFormat]?.downloadStatus === "QUEUED"
                              ? "outline"
                              : "default"
                          }
                          accessibilityLabel={
                            book[onlyFormat]?.downloadStatus === "DOWNLOADED"
                              ? `Remove ${onlyFormat}`
                              : book[onlyFormat]?.downloadStatus ===
                                    "DOWNLOADING" ||
                                  book[onlyFormat]?.downloadStatus === "QUEUED"
                                ? `Cancel ${onlyFormat} download`
                                : `Download ${onlyFormat}`
                          }
                          className={
                            book[onlyFormat]?.downloadStatus === "DOWNLOADED" ||
                            book[onlyFormat]?.downloadStatus ===
                              "DOWNLOADING" ||
                            book[onlyFormat]?.downloadStatus === "QUEUED"
                              ? "border-destructive dark:border-destructive"
                              : ""
                          }
                          onPress={() => {
                            const status = book[onlyFormat]?.downloadStatus
                            if (
                              status === "DOWNLOADING" ||
                              status === "QUEUED"
                            ) {
                              cancelDownload({
                                bookUuid: book.uuid,
                                format: onlyFormat,
                              })
                              return
                            }

                            if (status === "DOWNLOADED") {
                              setPendingDeleteFormat(onlyFormat)
                              return
                            }

                            downloadBook({
                              bookUuid: book.uuid,
                              format: onlyFormat,
                            })
                          }}
                        >
                          <Text
                            className={
                              book[onlyFormat]?.downloadStatus ===
                                "DOWNLOADED" ||
                              book[onlyFormat]?.downloadStatus ===
                                "DOWNLOADING" ||
                              book[onlyFormat]?.downloadStatus === "QUEUED"
                                ? "text-destructive"
                                : "text-primary-foreground"
                            }
                          >
                            {book[onlyFormat]?.downloadStatus === "DOWNLOADED"
                              ? ""
                              : book[onlyFormat]?.downloadStatus ===
                                    "DOWNLOADING" ||
                                  book[onlyFormat]?.downloadStatus === "QUEUED"
                                ? "Cancel download"
                                : `Download ${onlyFormat}`}
                          </Text>
                          {book[onlyFormat]?.downloadStatus ===
                            "DOWNLOADED" && (
                            <Icon
                              as={Trash2}
                              size={18}
                              className="text-destructive"
                            />
                          )}
                          {(book[onlyFormat]?.downloadStatus ===
                            "DOWNLOADING" ||
                            book[onlyFormat]?.downloadStatus === "QUEUED") && (
                            <Icon
                              as={CircleX}
                              size={16}
                              className="text-destructive"
                            />
                          )}
                        </Button>
                      </>
                    )
                  )}
                </Group>
              </Stack>
            </Group>
            {!!book.series.length && (
              <>
                <Group className="mb-2 flex-row items-center gap-1">
                  <Icon
                    as={LibrarySquare}
                    size={16}
                    className="text-muted-foreground"
                  />
                  <Text className="text-muted-foreground text-sm">Series</Text>
                </Group>
                <Group className="flex-stretch mb-4 flex-wrap">
                  {book.series.map((series) => (
                    <Link
                      href={{
                        pathname: "/series/[uuid]",
                        params: { uuid: series.uuid },
                      }}
                      key={series.uuid}
                      asChild
                      className="w-full justify-start"
                    >
                      <Button
                        accessibilityLabel={`Open series ${series.name}, book ${series.position}`}
                        variant="link"
                        className="y-0 mt-[-5px] flex flex-row items-center gap-1 px-0"
                      >
                        <Text className="text-primary">{series.name}</Text>
                        <Text className="text-muted-foreground font-normal">
                          #{series.position}
                        </Text>
                      </Button>
                    </Link>
                  ))}
                </Group>
              </>
            )}
            {!!book.tags.length && (
              <>
                <Group className="mb-2 flex-row items-center gap-1">
                  <Icon as={Tag} size={16} className="text-muted-foreground" />
                  <Text className="text-muted-foreground text-sm">Tags</Text>
                </Group>
                <Group className="mb-4 flex-wrap gap-2">
                  {tagsToShow.map((tag) => (
                    <Link
                      href={{
                        pathname: "/tag/[uuid]",
                        params: {
                          uuid: tag.uuid,
                        },
                      }}
                      key={tag.uuid}
                      asChild
                    >
                      <Button
                        accessibilityLabel={`Open tag ${tag.name}`}
                        variant="secondary"
                        size="sm"
                        className="flex flex-row items-center gap-2 rounded-full px-3"
                      >
                        {/* <Icon as={Tag} size={12} /> */}
                        <Text>{tag.name}</Text>
                      </Button>
                    </Link>
                  ))}
                  {tagsMoreNeeded && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-row items-center gap-2 rounded-full px-3"
                      accessibilityLabel={
                        showTagsMore
                          ? "Show fewer tags"
                          : `Show ${numTagsHidden} more tags`
                      }
                      onPress={() => {
                        setShowTagsMore(!showTagsMore)
                      }}
                    >
                      <Icon
                        as={showTagsMore ? ChevronLeft : ChevronRight}
                        size={12}
                      />
                      <Text>
                        {showTagsMore ? "Less" : "More (" + numTagsHidden + ")"}
                      </Text>
                    </Button>
                  )}
                </Group>
              </>
            )}
            {!!book.collections.length && (
              <>
                <Group className="mb-2 flex-row items-center gap-1">
                  <Icon
                    as={LibraryBig}
                    size={16}
                    className="text-muted-foreground"
                  />
                  <Text className="text-muted-foreground text-sm">
                    Collections
                  </Text>
                </Group>
                <Group className="flex-stretch mb-4 flex-wrap gap-2">
                  {collectionsToShow.map((collection) => (
                    <Link
                      href={{
                        pathname: `/collection/[uuid]`,
                        params: { uuid: collection.uuid },
                      }}
                      key={collection.uuid}
                      asChild
                    >
                      <Button
                        accessibilityLabel={`Open collection ${collection.name}`}
                        variant="secondary"
                        className="flex flex-row items-center gap-2 rounded-full px-4 py-0"
                      >
                        <Text>{collection.name}</Text>
                      </Button>
                    </Link>
                  ))}
                  {collectionsMoreNeeded && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-row items-center gap-2 rounded-full px-3"
                      accessibilityLabel={
                        showCollectionsMore
                          ? "Show fewer collections"
                          : `Show ${numCollectionsHidden} more collections`
                      }
                      onPress={() => {
                        setShowCollectionsMore(!showCollectionsMore)
                      }}
                    >
                      <Icon
                        as={showCollectionsMore ? ChevronLeft : ChevronRight}
                        size={12}
                      />
                      <Text>
                        {showCollectionsMore
                          ? "Less"
                          : "More (" + numCollectionsHidden + ")"}
                      </Text>
                    </Button>
                  )}
                </Group>
              </>
            )}
          </Stack>
          {excerpt && (
            <View className="px-safe-or-8 mb-4 gap-1">
              <Text className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                About
              </Text>
              <Text className="text-muted-foreground text-sm leading-5">
                {excerpt}
              </Text>
              <Text className="text-muted-foreground/70 text-xs">
                Excerpt from Open Library
              </Text>
            </View>
          )}
          <View className="pb-safe px-safe-or-8">
            <BookDescription
              description={book.description}
              textColor={foreground}
              dom={{ matchContents: true }}
            />
          </View>
        </Stack>
        {/* Spacer for the miniplayer */}
        <View className="h-40 w-full" />
      </ScrollView>
      <MiniPlayerWidget />
      <AlertDialog
        open={pendingDeleteFormat !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteFormat(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {pendingDeleteFormat} from device
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the downloaded {pendingDeleteFormat} files from
              your local device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                accessibilityLabel={`Remove ${pendingDeleteFormat} from device`}
                onPress={() => {
                  if (!pendingDeleteFormat) return
                  deleteBook({
                    bookUuid: book.uuid,
                    format: pendingDeleteFormat,
                    deleteRecord: book.serverUuid === null,
                  }).then(() => {
                    // move back to main screen
                    router.replace("/")

                    refetch()
                  })
                  setPendingDeleteFormat(null)
                }}
              >
                <Text>Remove</Text>
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}
