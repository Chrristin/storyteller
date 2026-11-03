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

import { ContinueCard } from "@/components/ContinueCard"
import { MiniPlayerWidget } from "@/components/MiniPlayerWidget"
import { Shelf } from "@/components/Shelf"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Menu } from "@/components/ui/menu"
import { Text } from "@/components/ui/text"
import { type BookWithRelations } from "@/database/books"
import { type Collection } from "@/database/collections"
import { useIsFocused } from "@/hooks/useIsFocused"
import { useListAllServerBooks } from "@/hooks/useListAllServerBooks"
import { useBookPrefsSync } from "@/lib/bookPrefsSync"
import { bookImported } from "@/store/actions"
import { useAppDispatch } from "@/store/appState"
import {
  useListBooksQuery as useListLocalBooksQuery,
  useListCollectionsQuery,
} from "@/store/localApi"

import { filterCurrentlyReading, filterStartReading } from "./shelf/[type]"

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

  const startReading = useMemo(() => filterStartReading(books), [books])

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
        contentContainerClassName="gap-8"
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
        {currentlyReading[0] && <ContinueCard book={currentlyReading[0]} />}
        <Shelf
          label="Also in progress"
          books={currentlyReading.slice(1)}
          showProgress
          href={{
            pathname: "/shelf/[type]",
            params: { type: "currently-reading" },
          }}
        />
        <Shelf
          label="Up next"
          books={startReading}
          href={{
            pathname: "/shelf/[type]",
            params: { type: "start-reading" },
          }}
        />
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
    </View>
  )
}
