import { useRouter } from "expo-router"
import { Check, Plus } from "lucide-react-native"
import { useMemo, useState } from "react"
import { Alert, FlatList, Pressable, ScrollView, View } from "react-native"

import { useAddTargets, useAddToCollection } from "@/hooks/useAddToCollection"
import { driveSelection, useDriveSelection } from "@/hooks/useDrive"
import {
  CREATE_KIND_ORDER,
  FILTERS,
  KIND_HELP,
  KIND_LABEL,
  type Target,
  type TargetFilter,
  type TargetKind,
  authorConfirmMessage,
  authorConfirmTitle,
  canCreate,
  createButtonLabel,
  filterTargets,
  findTarget,
  sheetTitle,
} from "@/lib/addToCollection"
import { cn } from "@/lib/utils"

import { Button } from "./ui/button"
import { Icon } from "./ui/icon"
import { Input } from "./ui/input"
import { Text } from "./ui/text"

const BADGE_CLASS: Record<TargetKind, string> = {
  series: "border-primary/40 text-primary",
  genre: "border-green-500/40 text-green-500",
  collection: "border-border text-muted-foreground",
  author: "border-amber-500/40 text-amber-500",
}

function KindBadge({ kind }: { kind: TargetKind }) {
  const classes = BADGE_CLASS[kind]
  const [border, text] = classes.split(" ") as [string, string]
  return (
    <View className={cn("rounded-full border px-2 py-0.5", border)}>
      <Text className={cn("text-[11px] font-semibold", text)}>
        {KIND_LABEL[kind]}
      </Text>
    </View>
  )
}

/**
 * The "Add to collection" sheet: pick an existing collection, series, genre or
 * author for the selected books, or create a new one.
 */
export function AddToCollectionSheet() {
  const router = useRouter()
  const selection = useDriveSelection()
  const targets = useAddTargets()
  const addToCollection = useAddToCollection()
  const selected = useMemo(() => [...selection.values()], [selection])
  const count = selected.length

  const [mode, setMode] = useState<"pick" | "create">("pick")
  const [filter, setFilter] = useState<TargetFilter>("all")
  const [query, setQuery] = useState("")
  const [name, setName] = useState("")
  const [kind, setKind] = useState<TargetKind>("series")
  const [busy, setBusy] = useState(false)

  const visible = useMemo(
    () => filterTargets(targets, filter, query),
    [targets, filter, query],
  )

  function run(
    chosenKind: TargetKind,
    chosenName: string,
    target: Target | null,
  ) {
    const execute = () => {
      setBusy(true)
      void addToCollection({
        kind: chosenKind,
        name: chosenName,
        target,
        selected: selected.map((book) => ({
          uuid: book.uuid,
          title: book.title,
          serverUuid: book.serverUuid,
        })),
      }).then((outcome) => {
        setBusy(false)
        if (outcome.ok) {
          Alert.alert("Added", outcome.message, [
            {
              text: "OK",
              onPress: () => {
                driveSelection.clear()
                router.back()
              },
            },
          ])
        } else {
          Alert.alert("Could not add", outcome.message)
        }
      })
    }

    if (chosenKind === "author") {
      Alert.alert(
        authorConfirmTitle(),
        authorConfirmMessage(target?.name ?? chosenName.trim(), count),
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add author", onPress: execute },
        ],
      )
      return
    }
    execute()
  }

  const existing = findTarget(targets, kind, name)

  if (count === 0) {
    return (
      <View className="bg-background p-6">
        <Text className="text-muted-foreground">No books selected.</Text>
      </View>
    )
  }

  return (
    <View className="bg-background flex-1">
      <View className="items-center py-2">
        <View className="bg-muted-foreground/40 h-1 w-12 rounded-full" />
      </View>
      {mode === "pick" ? (
        <View className="flex-1 px-5">
          <Text className="mb-3 text-[17px] font-bold">
            {sheetTitle(count)}
          </Text>
          <Input
            accessibilityLabel="Search collections, series, genres and authors"
            placeholder="Search..."
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            editable={!busy}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="my-2 max-h-10 grow-0"
            contentContainerClassName="gap-2 items-center"
            keyboardShouldPersistTaps="handled"
          >
            {FILTERS.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === option.id }}
                className={cn(
                  "rounded-full border px-3.5 py-1.5",
                  filter === option.id
                    ? "bg-primary border-primary"
                    : "border-border",
                )}
                onPress={() => setFilter(option.id)}
              >
                <Text
                  className={cn(
                    "text-xs font-semibold",
                    filter === option.id && "text-primary-foreground",
                  )}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <FlatList
            data={visible}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create new"
                className="border-border flex-row items-center gap-2.5 border-t py-3.5"
                disabled={busy}
                onPress={() => {
                  setName(query.trim())
                  setMode("create")
                }}
              >
                <Icon as={Plus} size={18} className="text-primary" />
                <Text className="text-primary text-[15px] font-semibold">
                  Create new...
                </Text>
              </Pressable>
            }
            ListEmptyComponent={
              <Text className="text-muted-foreground border-border border-t py-4 text-sm">
                Nothing matches. Use Create new to make it.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${KIND_LABEL[item.kind]}, ${item.count} ${item.count === 1 ? "book" : "books"}`}
                className="border-border flex-row items-center gap-2.5 border-t py-3"
                disabled={busy}
                onPress={() => run(item.kind, item.name, item)}
              >
                <View className="flex-1">
                  <Text className="text-[15px]" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    {item.count} {item.count === 1 ? "book" : "books"}
                  </Text>
                </View>
                <KindBadge kind={item.kind} />
              </Pressable>
            )}
            ListFooterComponent={<View className="h-10" />}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="pb-10"
        >
          <Text className="mb-3 text-[17px] font-bold">Create new</Text>
          <Text className="text-muted-foreground mb-1.5 text-xs">NAME</Text>
          <Input
            accessibilityLabel="Name"
            value={name}
            onChangeText={setName}
            autoFocus
            editable={!busy}
          />
          <Text className="text-muted-foreground mt-4 mb-1.5 text-xs">
            KIND
          </Text>
          <View className="gap-2">
            {CREATE_KIND_ORDER.map((option) => {
              const on = kind === option
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  className={cn(
                    "flex-row items-center gap-3 rounded-xl border px-3 py-2.5",
                    on ? "border-primary bg-primary/10" : "border-border",
                  )}
                  disabled={busy}
                  onPress={() => setKind(option)}
                >
                  <View
                    className={cn(
                      "size-[18px] items-center justify-center rounded-full border-2",
                      on
                        ? "border-primary bg-primary"
                        : "border-muted-foreground",
                    )}
                  >
                    {on && (
                      <Icon
                        as={Check}
                        size={11}
                        className="text-primary-foreground"
                      />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">
                      {KIND_LABEL[option]}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {KIND_HELP[option]}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
          {existing && (
            <Text className="text-muted-foreground mt-3 text-xs">
              A {KIND_LABEL[kind].toLowerCase()} called {existing.name} already
              exists. The books will be added to it.
            </Text>
          )}
          <View className="mt-4 flex-row gap-2.5">
            <Button
              size="lg"
              className="flex-1 rounded-full"
              accessibilityLabel={createButtonLabel(count)}
              disabled={busy || !canCreate(name)}
              onPress={() => run(kind, name, existing)}
            >
              <Text className="text-primary-foreground">
                {busy ? "Adding..." : createButtonLabel(count)}
              </Text>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              disabled={busy}
              onPress={() => setMode("pick")}
            >
              <Text>Back</Text>
            </Button>
          </View>
        </ScrollView>
      )}
    </View>
  )
}
