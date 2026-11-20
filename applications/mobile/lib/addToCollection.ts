/**
 * Pure logic for "Add to collection" in the selection bar: the list of things
 * a book can be added to (collections, series, genres and authors), searching
 * it, and turning a choice into the requests the server takes.
 *
 * Server routes used (all under /api/v2):
 *   collection: POST /collections {name, description, public} to create,
 *               POST /collections/books {collections: uuid[], books: uuid[]}
 *   series:     POST /series/books {series: {uuid?, name}, relations:
 *               {bookUuid, position, featured}[]}
 *   genre:      POST /books/tags {tags: {name}[], books: uuid[]} (a tag)
 *   author:     POST /books/creators {creators: {name}[], books: uuid[],
 *               role: "aut"}
 */

import {
  baseNormalise,
  chooseCanonical,
  cleanSeriesDisplayName,
  normaliseAuthorName,
  normaliseSeriesName,
} from "./nameKey"
import { isWholePosition } from "./seriesGaps"

export type TargetKind = "collection" | "series" | "genre" | "author"
export type TargetFilter = "all" | TargetKind

const TARGET_KINDS: readonly TargetKind[] = [
  "collection",
  "series",
  "genre",
  "author",
]

export const KIND_LABEL: Record<TargetKind, string> = {
  collection: "Collection",
  series: "Series",
  genre: "Genre",
  author: "Author",
}

export const KIND_HELP: Record<TargetKind, string> = {
  series: "Books in a numbered order. Set the order later on the series page.",
  collection: "Your own list, any books.",
  genre: "A tag like Epic fantasy.",
  author: "Sets the author on these books.",
}

/** The order the kinds are offered in when creating. */
export const CREATE_KIND_ORDER: readonly TargetKind[] = [
  "series",
  "collection",
  "genre",
  "author",
]

export const FILTERS: readonly { id: TargetFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "collection", label: "Collections" },
  { id: "series", label: "Series" },
  { id: "genre", label: "Genres" },
  { id: "author", label: "Authors" },
]

/** The parts of a local book this logic reads. `BookWithRelations` fits. */
export interface TargetBook {
  uuid: string
  serverUuid: string | null
  authors: { uuid: string; name: string }[]
  series: { uuid: string; name: string; position: number | null }[]
  tags: { uuid: string; name: string }[]
  collections: { uuid: string; name: string }[]
}

export interface TargetCollection {
  uuid: string
  name: string
  serverUuid: string | null
}

/** One server's copy of an item. */
export interface TargetRef {
  serverUuid: string
  uuid: string
  name: string
}

export interface Target {
  id: string
  kind: TargetKind
  name: string
  /** Books on this phone that are in it. */
  count: number
  /** Where it exists, one entry per server. */
  refs: TargetRef[]
}

export function nameKeyFor(kind: TargetKind, name: string) {
  switch (kind) {
    case "author":
      return normaliseAuthorName(name)
    case "series":
      return normaliseSeriesName(name)
    default:
      return baseNormalise(name)
  }
}

interface Entry {
  serverUuid: string
  uuid: string
  name: string
  books: Set<string>
}

/**
 * Everything a book can be added to, built from the local books and
 * collections. Spellings of one name merge (authors "J. R. R. Tolkien" and
 * "J.R.R. Tolkien", series "The Expanse" and "Expanse 02"); the same name on
 * two servers is one item with a reference per server.
 */
export function buildTargets(
  books: readonly TargetBook[],
  collections: readonly TargetCollection[] = [],
): Target[] {
  const entries = new Map<TargetKind, Map<string, Entry>>(
    TARGET_KINDS.map((kind) => [kind, new Map()]),
  )

  function add(
    kind: TargetKind,
    serverUuid: string,
    ref: { uuid: string; name: string },
    bookUuid?: string,
  ) {
    const map = entries.get(kind)!
    const id = `${serverUuid}:${ref.uuid}`
    let entry = map.get(id)
    if (!entry) {
      entry = {
        serverUuid,
        uuid: ref.uuid,
        name: ref.name,
        books: new Set(),
      }
      map.set(id, entry)
    }
    if (bookUuid) entry.books.add(bookUuid)
  }

  for (const collection of collections) {
    if (collection.serverUuid)
      add("collection", collection.serverUuid, collection)
  }
  for (const book of books) {
    // A book only on this phone is not on any server, so it has no items.
    if (!book.serverUuid) continue
    for (const c of book.collections)
      add("collection", book.serverUuid, c, book.uuid)
    for (const s of book.series) add("series", book.serverUuid, s, book.uuid)
    for (const t of book.tags) add("genre", book.serverUuid, t, book.uuid)
    for (const a of book.authors) add("author", book.serverUuid, a, book.uuid)
  }

  const targets: Target[] = []
  for (const kind of TARGET_KINDS) {
    const groups = new Map<string, Entry[]>()
    for (const entry of entries.get(kind)!.values()) {
      const key = nameKeyFor(kind, entry.name)
      if (!key) continue
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }
    for (const [key, group] of groups) {
      const display = chooseCanonical(
        group.map((e) => ({
          uuid: `${e.serverUuid}:${e.uuid}`,
          name: e.name,
          books: e.books.size,
        })),
      )
      const all = new Set<string>()
      const perServer = new Map<string, Entry>()
      for (const entry of group) {
        entry.books.forEach((uuid) => all.add(uuid))
        const best = perServer.get(entry.serverUuid)
        if (
          !best ||
          entry.books.size > best.books.size ||
          (entry.books.size === best.books.size && entry.uuid < best.uuid)
        ) {
          perServer.set(entry.serverUuid, entry)
        }
      }
      targets.push({
        id: `${kind}:${key}`,
        kind,
        name:
          kind === "series"
            ? cleanSeriesDisplayName(display.name)
            : display.name,
        count: all.size,
        refs: [...perServer.values()].map((e) => ({
          serverUuid: e.serverUuid,
          uuid: e.uuid,
          name: e.name,
        })),
      })
    }
  }
  return targets
}

/** The item of this kind with this name (spellings merged), if there is one. */
export function findTarget(
  targets: readonly Target[],
  kind: TargetKind,
  name: string,
): Target | null {
  const key = nameKeyFor(kind, name)
  if (!key) return null
  return (
    targets.find((t) => t.kind === kind && t.id === `${kind}:${key}`) ?? null
  )
}

/** Items for the list: filtered by kind and search text, sorted by name. */
export function filterTargets(
  targets: readonly Target[],
  filter: TargetFilter,
  query: string,
): Target[] {
  const needle = baseNormalise(query)
  return targets
    .filter((t) => filter === "all" || t.kind === filter)
    .filter((t) => !needle || baseNormalise(t.name).includes(needle))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
        a.kind.localeCompare(b.kind),
    )
}

// ---------------------------------------------------------------------------
// Selection

export interface SelectedRef {
  uuid: string
  title: string
  serverUuid: string | null
}

/** Groups the selected books by server. Books on no server are skipped. */
export function groupSelectedByServer<T extends SelectedRef>(
  selected: readonly T[],
) {
  const servers = new Map<string, T[]>()
  const skipped: T[] = []
  for (const book of selected) {
    if (!book.serverUuid) {
      skipped.push(book)
      continue
    }
    servers.set(book.serverUuid, [
      ...(servers.get(book.serverUuid) ?? []),
      book,
    ])
  }
  return { servers, skipped }
}

export interface SeriesRelation {
  bookUuid: string
  position: number
  featured: boolean
}

/**
 * Series positions for added books. A new series numbers them 1..N in the
 * order given. An existing series continues after its highest whole position.
 * Nothing already in the series is touched.
 */
export function buildSeriesRelations(
  bookUuids: readonly string[],
  existingPositions: readonly (number | null | undefined)[] = [],
): SeriesRelation[] {
  const highest = existingPositions
    .filter(isWholePosition)
    .reduce((max, position) => Math.max(max, position), 0)
  return bookUuids.map((bookUuid, index) => ({
    bookUuid,
    position: highest + index + 1,
    featured: false,
  }))
}

function isMember(kind: TargetKind, book: TargetBook, key: string) {
  const names =
    kind === "collection"
      ? book.collections
      : kind === "series"
        ? book.series
        : kind === "genre"
          ? book.tags
          : book.authors
  return names.some((entry) => nameKeyFor(kind, entry.name) === key)
}

export interface ServerPlan {
  serverUuid: string
  /** The existing item on this server, or null when it must be made. */
  ref: TargetRef | null
  name: string
  /** Books to add (those already in it are left out). */
  bookUuids: string[]
  alreadyIn: number
  /** Series only. */
  relations: SeriesRelation[]
}

export interface AddPlan {
  plans: ServerPlan[]
  skipped: SelectedRef[]
}

/**
 * What to send to each server. `target` is the existing item, or null to make
 * one called `name`. Books already in the item are left out.
 */
export function planAdd(input: {
  kind: TargetKind
  name: string
  target: Target | null
  selected: readonly SelectedRef[]
  books: readonly TargetBook[]
}): AddPlan {
  const { kind, target, selected, books } = input
  const name = target?.name ?? input.name.trim()
  const key = nameKeyFor(kind, name)
  const byUuid = new Map(books.map((b) => [b.uuid, b]))
  const { servers, skipped } = groupSelectedByServer(selected)

  const plans: ServerPlan[] = []
  for (const [serverUuid, group] of servers) {
    const ref = target?.refs.find((r) => r.serverUuid === serverUuid) ?? null
    const fresh = group.filter((book) => {
      const local = byUuid.get(book.uuid)
      return !(local && isMember(kind, local, key))
    })
    let relations: SeriesRelation[] = []
    if (kind === "series") {
      const existing = ref
        ? books.flatMap((b) =>
            b.serverUuid === serverUuid
              ? b.series
                  .filter((s) => s.uuid === ref.uuid)
                  .map((s) => s.position)
              : [],
          )
        : []
      relations = buildSeriesRelations(
        fresh.map((b) => b.uuid),
        existing,
      )
    }
    plans.push({
      serverUuid,
      ref,
      name,
      bookUuids: fresh.map((b) => b.uuid),
      alreadyIn: group.length - fresh.length,
      relations,
    })
  }
  return { plans, skipped }
}

export interface AddRequest {
  method: "POST"
  /** Relative to /api/v2. */
  url: string
  body: unknown
}

/** The request that adds a plan's books. A collection needs its uuid first. */
export function buildAddRequest(
  kind: TargetKind,
  plan: ServerPlan,
  collectionUuid?: string,
): AddRequest | null {
  if (plan.bookUuids.length === 0) return null
  switch (kind) {
    case "collection": {
      const uuid = collectionUuid ?? plan.ref?.uuid
      if (!uuid) return null
      return {
        method: "POST",
        url: "/collections/books",
        body: { collections: [uuid], books: plan.bookUuids },
      }
    }
    case "series":
      return {
        method: "POST",
        url: "/series/books",
        body: {
          series: plan.ref
            ? { uuid: plan.ref.uuid, name: plan.ref.name }
            : { name: plan.name },
          relations: plan.relations,
        },
      }
    case "genre":
      return {
        method: "POST",
        url: "/books/tags",
        body: {
          tags: [{ name: plan.ref?.name ?? plan.name }],
          books: plan.bookUuids,
        },
      }
    case "author":
      return {
        method: "POST",
        url: "/books/creators",
        body: {
          creators: [{ name: plan.ref?.name ?? plan.name }],
          books: plan.bookUuids,
          role: "aut",
        },
      }
  }
}

/** The request that makes a collection (only collections are made first). */
export function buildCreateCollectionRequest(name: string): AddRequest {
  return {
    method: "POST",
    url: "/collections",
    body: { name: name.trim(), description: "", public: false },
  }
}

// ---------------------------------------------------------------------------
// Text

const noun = (count: number) => (count === 1 ? "book" : "books")

export function sheetTitle(count: number) {
  return `Add ${count} ${noun(count)} to`
}

export function createButtonLabel(count: number) {
  return `Create and add ${count} ${noun(count)}`
}

export function canCreate(name: string) {
  return name.trim().length > 0
}

export function authorConfirmTitle() {
  return "Change author?"
}

export function authorConfirmMessage(name: string, count: number) {
  return `This adds ${name} as an author of ${count} ${noun(count)}. It changes their metadata.`
}

export interface AddSummary {
  added: number
  alreadyIn: number
  skipped: number
  name: string
}

export function summarizeAdd({ added, alreadyIn, skipped, name }: AddSummary) {
  const parts: string[] = []
  if (added > 0) parts.push(`Added ${added} ${noun(added)} to ${name}.`)
  else parts.push(`Nothing to add to ${name}.`)
  if (alreadyIn > 0) {
    parts.push(
      `${alreadyIn} ${alreadyIn === 1 ? "was" : "were"} already in it.`,
    )
  }
  if (skipped > 0) {
    parts.push(`${skipped} ${noun(skipped)} only on this phone, left out.`)
  }
  return parts.join(" ")
}

/** Plain English for a failed request. */
export function addErrorMessage(
  error: unknown,
  kind: TargetKind,
  name = "",
): string {
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown }).status
    if (status === 403) {
      return kind === "collection"
        ? "You do not have permission to change collections on this server."
        : "You do not have permission to edit books on this server."
    }
    if (status === 409) {
      return `A ${KIND_LABEL[kind].toLowerCase()} named "${name}" already exists.`
    }
    if (status === "FETCH_ERROR") return "Could not reach the server."
    const data = (error as { data?: unknown }).data
    if (typeof data === "object" && data !== null) {
      const message = (data as { message?: unknown }).message
      if (typeof message === "string" && message) return message
    }
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message) return message
  }
  return "Something went wrong. Try again."
}
