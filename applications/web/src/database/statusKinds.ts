export const STATUS_UNREAD = "Unread"
export const STATUS_TO_READ = "To read"
export const STATUS_READING = "Reading"
export const STATUS_READ = "Read"

export const WELL_KNOWN_STATUS_NAMES = new Set([
  STATUS_UNREAD,
  STATUS_TO_READ,
  STATUS_READING,
  STATUS_READ,
])

export function isWellKnownStatus(name: string): boolean {
  return WELL_KNOWN_STATUS_NAMES.has(name)
}

export function statusDisplayLabel(status: {
  name: string
  label: string | null
}): string {
  return status.label ?? status.name
}

// Display order for status lists and menus: Unread first, then the other
// well-known statuses in reading order, then custom statuses.
const WELL_KNOWN_ORDER = [
  STATUS_UNREAD,
  STATUS_TO_READ,
  STATUS_READING,
  STATUS_READ,
]

export function statusSortRank(name: string): number {
  const index = WELL_KNOWN_ORDER.indexOf(name)
  return index === -1 ? WELL_KNOWN_ORDER.length : index
}

// Stable: statuses with the same rank keep their incoming order.
export function sortStatuses<T extends { name: string }>(statuses: T[]): T[] {
  return statuses
    .map((status, index) => ({ status, index }))
    .sort(
      (a, b) =>
        statusSortRank(a.status.name) - statusSortRank(b.status.name) ||
        a.index - b.index,
    )
    .map(({ status }) => status)
}

// Statuses from which starting a book moves it to "Reading" (and finishing it
// moves it to "Read"). A book with no status counts too.
export const STARTABLE_STATUS_NAMES = new Set([STATUS_UNREAD, STATUS_TO_READ])
