/**
 * Pure rules for the Home screen sections: which books each section shows,
 * in what order and how many. Each section's title row has an "All" link.
 */

export const STATUS_UNREAD = "Unread"
export const STATUS_TO_READ = "To read"
export const STATUS_READING = "Reading"
export const STATUS_READ = "Read"

export interface SectionBook {
  uuid: string
  createdAt: string
  status?: { name: string } | null
  position?: { timestamp: number } | null
}

export type HomeSectionId = "to-read" | "recently-added" | "recently-completed"

export interface HomeSectionConfig {
  id: HomeSectionId
  title: string
  /** The shelf screen type that lists every book of the section. */
  shelfType: "to-read" | "start-reading" | "completed"
  limit: number
}

export const HOME_SECTIONS: readonly HomeSectionConfig[] = [
  {
    id: "to-read",
    title: "To Read",
    shelfType: "to-read",
    limit: 6,
  },
  {
    id: "recently-added",
    title: "Recently Added",
    shelfType: "start-reading",
    limit: 9,
  },
  {
    id: "recently-completed",
    title: "Recently Completed",
    shelfType: "completed",
    limit: 6,
  },
]

function addedTime(book: SectionBook) {
  return new Date(book.createdAt).valueOf() || 0
}

function newestAddedFirst<T extends SectionBook>(a: T, b: T) {
  return addedTime(b) - addedTime(a)
}

/** Every book, newest added first. */
export function sortRecentlyAdded<T extends SectionBook>(books: readonly T[]) {
  return [...books].sort(newestAddedFirst)
}

/**
 * Books the user marked "To read", newest added first. Books that only
 * arrived ("Unread", or no status) are not on this list.
 */
export function filterToRead<T extends SectionBook>(books: readonly T[]) {
  return books
    .filter((book) => book.status?.name === STATUS_TO_READ)
    .sort(newestAddedFirst)
}

/**
 * Books with status "Read", most recently finished first. The local data has
 * no time for when the status was set, so this uses the last reading position
 * timestamp, then newest added for books without a position.
 */
export function filterRecentlyCompleted<T extends SectionBook>(
  books: readonly T[],
) {
  return books
    .filter((book) => book.status?.name === STATUS_READ)
    .sort(
      (a, b) =>
        (b.position?.timestamp ?? 0) - (a.position?.timestamp ?? 0) ||
        newestAddedFirst(a, b),
    )
}

export interface SectionView<T> {
  shown: T[]
  /** True when there are more books than the grid shows. */
  hasMore: boolean
}

/** What a section shows. An empty section renders nothing at all. */
export function sectionView<T>(
  books: readonly T[],
  limit: number,
): SectionView<T> | null {
  if (books.length === 0) return null
  return { shown: books.slice(0, limit), hasMore: books.length > limit }
}

export type ToReadAction = "add" | "remove" | null

/**
 * The one tap To Read action for a single book. "To read" removes the mark;
 * Reading and Read are left alone; anything else (Unread, none, custom) adds.
 */
export function toReadActionForStatus(
  statusName: string | null | undefined,
): ToReadAction {
  if (statusName === STATUS_TO_READ) return "remove"
  if (statusName === STATUS_READING || statusName === STATUS_READ) return null
  return "add"
}

export function toReadActionLabel(action: "add" | "remove") {
  return action === "add" ? "Add to To Read" : "Remove from To Read"
}

/** A book that is being read or finished is never moved back to To read. */
export function canAddToRead(statusName: string | null | undefined) {
  return toReadActionForStatus(statusName) === "add"
}

/**
 * The action for a selection: remove when every book is To read, add when at
 * least one book can be added (Reading and Read books are left alone).
 */
export function selectionToReadAction(
  statusNames: readonly (string | null | undefined)[],
): "add" | "remove" | null {
  if (statusNames.length === 0) return null
  if (statusNames.every((name) => name === STATUS_TO_READ)) return "remove"
  return statusNames.some(canAddToRead) ? "add" : null
}

export function selectionToReadLabel(action: "add" | "remove", count: number) {
  return action === "add"
    ? `Add ${count} to To Read`
    : `Remove ${count} from To Read`
}

export function toReadProgressLabel(
  action: "add" | "remove",
  done: number,
  total: number,
) {
  return `${action === "add" ? "Adding" : "Removing"} ${done} of ${total}`
}

const STATUS_ORDER = [
  STATUS_UNREAD,
  STATUS_TO_READ,
  STATUS_READING,
  STATUS_READ,
]

/** Menu order for statuses: Unread, To read, Reading, Read, then the rest. */
export function sortStatuses<T extends { name: string }>(
  statuses: readonly T[],
) {
  const rank = (name: string) => {
    const index = STATUS_ORDER.indexOf(name)
    return index === -1 ? STATUS_ORDER.length : index
  }
  return statuses
    .map((status, index) => ({ status, index }))
    .sort(
      (a, b) => rank(a.status.name) - rank(b.status.name) || a.index - b.index,
    )
    .map(({ status }) => status)
}
