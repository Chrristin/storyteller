import { describe, expect, it } from "vitest"

import {
  HOME_SECTIONS,
  canAddToRead,
  sortStatuses,
  filterRecentlyCompleted,
  filterToRead,
  selectionToReadAction,
  selectionToReadLabel,
  sectionView,
  sortRecentlyAdded,
  toReadActionForStatus,
  toReadActionLabel,
  toReadProgressLabel,
} from "./homeSections"

function book(
  uuid: string,
  createdAt: string,
  status?: string,
  timestamp?: number,
) {
  return {
    uuid,
    createdAt,
    status: status ? { name: status } : null,
    position: timestamp === undefined ? null : { timestamp },
  }
}

describe("sections config", () => {
  it("has the approved limits and shelves", () => {
    expect(HOME_SECTIONS.map((s) => [s.title, s.limit, s.shelfType])).toEqual([
      ["To Read", 6, "to-read"],
      ["Recently Added", 9, "start-reading"],
      ["Recently Completed", 6, "completed"],
    ])
  })
})

describe("filters", () => {
  const books = [
    book("a", "2024-01-01", "To read"),
    book("b", "2024-03-01", "To read"),
    book("c", "2024-02-01", "Reading"),
    book("d", "2024-02-01"),
    book("e", "2024-01-01", "Read", 100),
    book("f", "2024-05-01", "Read", 300),
    book("g", "2024-04-01", "Read", 300),
    book("h", "2024-01-01", "Read"),
    book("i", "2023-06-01", "Unread"),
  ]

  it("sorts every book newest added first", () => {
    expect(sortRecentlyAdded(books).map((b) => b.uuid)[0]).toBe("f")
    expect(sortRecentlyAdded(books)).toHaveLength(books.length)
  })

  it("keeps only To read, newest first", () => {
    expect(filterToRead(books).map((b) => b.uuid)).toEqual(["b", "a"])
  })

  it("leaves Unread and status-less books off To Read", () => {
    const uuids = filterToRead(books).map((b) => b.uuid)
    expect(uuids).not.toContain("i")
    expect(uuids).not.toContain("d")
  })

  it("orders completed by last position, then newest added", () => {
    expect(filterRecentlyCompleted(books).map((b) => b.uuid)).toEqual([
      "f",
      "g",
      "e",
      "h",
    ])
  })

  it("does not change the input", () => {
    const copy = [...books]
    sortRecentlyAdded(books)
    filterToRead(books)
    filterRecentlyCompleted(books)
    expect(books).toEqual(copy)
  })
})

describe("sectionView", () => {
  it("renders nothing when empty", () => {
    expect(sectionView([], 6)).toBeNull()
  })
  it("shows all under the limit", () => {
    expect(sectionView([1, 2, 3], 6)).toEqual({ shown: [1, 2, 3] })
  })
  it("cuts at the limit", () => {
    expect(sectionView([1, 2, 3, 4, 5, 6, 7], 6)).toEqual({
      shown: [1, 2, 3, 4, 5, 6],
    })
  })
})

describe("To Read actions", () => {
  it("picks the single book action", () => {
    expect(toReadActionForStatus(null)).toBe("add")
    expect(toReadActionForStatus("Custom")).toBe("add")
    expect(toReadActionForStatus("Unread")).toBe("add")
    expect(toReadActionForStatus("To read")).toBe("remove")
    expect(toReadActionForStatus("Reading")).toBeNull()
    expect(toReadActionForStatus("Read")).toBeNull()
  })
  it("labels", () => {
    expect(toReadActionLabel("add")).toBe("Add to To Read")
    expect(toReadActionLabel("remove")).toBe("Remove from To Read")
  })
  it("picks the selection action", () => {
    expect(selectionToReadAction([])).toBeNull()
    expect(selectionToReadAction(["To read", "To read"])).toBe("remove")
    expect(selectionToReadAction(["To read", null])).toBe("add")
    expect(selectionToReadAction(["Read", "Reading"])).toBeNull()
    expect(selectionToReadAction(["Read", null])).toBe("add")
    expect(selectionToReadAction(["Unread", "Unread"])).toBe("add")
    expect(selectionToReadAction(["To read", "Unread"])).toBe("add")
    expect(canAddToRead("Unread")).toBe(true)
    expect(canAddToRead("To read")).toBe(false)
    expect(selectionToReadLabel("add", 3)).toBe("Add 3 to To Read")
    expect(selectionToReadLabel("remove", 2)).toBe("Remove 2 from To Read")
    expect(toReadProgressLabel("add", 1, 4)).toBe("Adding 1 of 4")
    expect(toReadProgressLabel("remove", 1, 4)).toBe("Removing 1 of 4")
  })
})

describe("sortStatuses", () => {
  it("puts Unread first, then To read, Reading, Read, then the rest", () => {
    const names = ["Read", "Zebra", "Reading", "Unread", "Abandoned", "To read"]
    expect(
      sortStatuses(names.map((name) => ({ name }))).map((s) => s.name),
    ).toEqual(["Unread", "To read", "Reading", "Read", "Zebra", "Abandoned"])
  })
})
