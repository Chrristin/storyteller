import * as DocumentPicker from "expo-document-picker"
import { Link, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { EllipsisVertical, Search } from "lucide-react-native"
import { useEffect, useMemo, useRef } from "react"
import {
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  TouchableOpacity,
  View,
} from "react-native"

import { AuthorCollectionsSection } from "@/components/AuthorCollectionsSection"
import { CurrentlyReading } from "@/components/CurrentlyReading"
import { DriveSelectionBars } from "@/components/DriveSelectionBars"
import { MiniPlayerWidget } from "@/components/MiniPlayerWidget"
import { HomeSection } from "@/components/HomeSection"
import { Shelf } from "@/components/Shelf"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Menu } from "@/components/ui/menu"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { type Collection } from "@/database/collections"
import { useIsFocused } from "@/hooks/useIsFocused"
import { useListAllServerBooks } from "@/hooks/useListAllServerBooks"
import { buildAuthorCollections } from "@/lib/authorCollections"
import { useBookPrefsSync } from "@/lib/bookPrefsSync"
import {
  HOME_SECTIONS,
  filterRecentlyCompleted,
  filterToRead,
  sortRecentlyAdded,
} from "@/lib/homeSections"
import { useLibraryLook } from "@/lib/libraryLook"
import { bookImported } from "@/store/actions"
import { useAppDispatch } from "@/store/appState"
import {
  useListBooksQuery as useListLocalBooksQuery,
  useListCollectionsQuery,
} from "@/store/localApi"

import { filterCurrentlyReading } from "./shelf/[type]"

const EMPTY_BOOKS: BookWithRelations[] = []
const EMPTY_COLLECTIONS: Collection[] = []

async function pickBookFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/epub+zip", "application/epub"],
    copyToCacheDirectory: true,
  })

  if (result.canceled || !result.assets[0]) return null

  return result.assets[0].uri
}

export default function Home() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const [{ showCurrentlyReading }] = useLibraryLook()

  const { isLoading, refetch } = useListAllServerBooks()
  useBookPrefsSync()
  const { data: liveBooks = EMPTY_BOOKS } = useListLocalBooksQuery()
  const { data: collections = EMPTY_COLLECTIONS } = useListCollectionsQuery()

  const staleBooksRef = useRef<BookWithRelations[]>(liveBooks)

  const isFocused = useIsFocused()
  const books = isFocused ? liveBooks : staleBooksRef.current

  useEffect(() => {
    if (isFocused) {
      staleBooksRef.current = liveBooks
    }
  }, [isFocused, liveBooks])

  const currentlyReading = useMemo(() => {
    return filterCurrentlyReading(books)
  }, [books])

  const sectionBooks = useMemo(
    () => ({
      "to-read": filterToRead(books),
      "recently-added": sortRecentlyAdded(books),
      "recently-completed": filterRecentlyCompleted(books),
    }),
    [books],
  )

  const authorCollections = useMemo(
    () => buildAuthorCollections(books),
    [books],
  )

  const booksByCollection = useMemo(
    () =>
      Object.fromEntries(
        collections.map((collection) => [
          collection.uuid,
          books
            .filter((book) =>
              book.collections.some((c) => c.uuid === collection.uuid),
            )
            .sort(
              (a, b) =>
                new Date(b.createdAt).valueOf() -
                new Date(a.createdAt).valueOf(),
            ),
        ]),
      ),
    [books, collections],
  )

  const scrollViewRef = useRef<ScrollViewInstance>(null)

  return (
    <View className="pt-safe flex-1 items-center gap-2 bg-transparent">
      <StatusBar verticalBarBehaviorIOS="disabled" />
      <View className="pr-safe-or-4 pl-safe-or-5 w-full flex-row items-center justify-between pt-2 pb-3">
        <TouchableOpacity
          accessibilityLabel="Scroll to top"
          accessibilityRole="button"
          onPress={() => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true })
          }}
        >
          <Text className="text-[26px] font-bold tracking-tight">Library</Text>
        </TouchableOpacity>
        <View className="flex-row items-center gap-2">
          <Link href="/search" asChild>
            <Button
              variant="secondary"
              size="icon"
              accessibilityLabel="Search books"
            >
              <Icon as={Search} size={20} />
            </Button>
          </Link>
          <Menu
            actions={[
              {
                id: "import-book",
                title: "Import book",
                onPress: async () => {
                  const uri = await pickBookFile()
                  if (uri) dispatch(bookImported({ url: uri, from: "home" }))
                },
              },
              {
                id: "series",
                title: "Series",
                onPress: () => router.push("/series-list"),
              },
              {
                id: "settings",
                title: "Settings",
                onPress: () => router.push("/settings"),
              },
            ]}
          >
            <Button
              variant="secondary"
              size="icon"
              accessibilityLabel="Open home menu"
            >
              <Icon as={EllipsisVertical} size={20} />
            </Button>
          </Menu>
        </View>
      </View>
      <ScrollView
        className="pl-safe-or-5 pr-safe-or-5 w-full"
        contentContainerClassName="gap-4"
        ref={scrollViewRef}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              refetch()
            }}
          />
        }
      >
        {showCurrentlyReading && <CurrentlyReading books={currentlyReading} />}
        {HOME_SECTIONS.map((section) => (
          <HomeSection
            key={section.id}
            title={section.title}
            books={sectionBooks[section.id]}
            limit={section.limit}
            buttonLabel={section.buttonLabel}
            href={{
              pathname: "/shelf/[type]",
              params: { type: section.shelfType },
            }}
          />
        ))}
        {collections.map((collection) => (
          <Shelf
            key={collection.uuid}
            label={collection.name}
            books={booksByCollection[collection.uuid] ?? []}
            href={{
              pathname: "/collection/[uuid]",
              params: {
                uuid: collection.uuid,
              },
            }}
          />
        ))}
        <AuthorCollectionsSection collections={authorCollections} />
        {books.length === 0 && (
          <View className="bg-secondary mr-5 gap-3 rounded-xl p-4">
            <Text>You don’t have any books available, yet!</Text>
            <Text>
              You can{" "}
              <Link href="/server">
                <Text className="text-link">
                  connect to a Storyteller instance
                </Text>
              </Link>{" "}
              to download some.
            </Text>
          </View>
        )}
        {/* Spacer for the miniplayer */}
        <View className="h-40 w-full" />
      </ScrollView>
      <MiniPlayerWidget />
      <DriveSelectionBars books={books} />
    </View>
  )
}
