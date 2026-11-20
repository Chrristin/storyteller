import { describe, expect, it } from "vitest"

import {
  archiveBarLabel,
  archiveErrorMessage,
  archiveMenuLabel,
  archiveResultMessage,
  archivedAtOf,
  buildArchiveRequest,
  filterArchived,
  groupByServer,
  isArchived,
  sortNewestArchivedFirst,
} from "./archive"

const books = [
  { uuid: "a", archivedAt: null },
  { uuid: "b", archivedAt: "2026-01-02T00:00:00.000Z" },
  { uuid: "c" },
  { uuid: "d", archivedAt: "2026-03-01T00:00:00.000Z" },
]

describe("archived filter", () => {
  it("treats a missing archivedAt (old server) as not archived", () => {
    expect(archivedAtOf({})).toBeNull()
    expect(isArchived({})).toBe(false)
    expect(isArchived({ archivedAt: "2026-01-01T00:00:00.000Z" })).toBe(true)
  })

  it("excludes archived books", () => {
    expect(filterArchived(books, "exclude").map((b) => b.uuid)).toEqual([
      "a",
      "c",
    ])
  })

  it("keeps only archived books", () => {
    expect(filterArchived(books, "only").map((b) => b.uuid)).toEqual(["b", "d"])
  })

  it("sorts newest archived first", () => {
    expect(
      sortNewestArchivedFirst(filterArchived(books, "only")).map((b) => b.uuid),
    ).toEqual(["d", "b"])
  })
})

describe("groupByServer", () => {
  it("groups by server, keeps local books apart and drops duplicates", () => {
    const result = groupByServer([
      { uuid: "1", serverUuid: "s1" },
      { uuid: "2", serverUuid: "s2" },
      { uuid: "3", serverUuid: "s1" },
      { uuid: "4", serverUuid: null },
      { uuid: "1", serverUuid: "s1" },
    ])
    expect(result.servers).toEqual([
      { serverUuid: "s1", bookUuids: ["1", "3"] },
      { serverUuid: "s2", bookUuids: ["2"] },
    ])
    expect(result.local).toEqual(["4"])
  })

  it("is empty for no books", () => {
    expect(groupByServer([])).toEqual({ servers: [], local: [] })
  })
})

describe("labels", () => {
  it("labels the menu action", () => {
    expect(archiveMenuLabel(true)).toBe("Move back to library")
    expect(archiveMenuLabel(false)).toBe("Move to Archive")
  })

  it("adds the count to the bar label", () => {
    expect(archiveBarLabel(true, 1)).toBe("Move back to library")
    expect(archiveBarLabel(true, 3)).toBe("Move 3 back to library")
    expect(archiveBarLabel(false, 2)).toBe("Move 2 to Archive")
  })

  it("words the result message", () => {
    expect(archiveResultMessage(3, true)).toBe("Moved 3 books to the Archive.")
    expect(archiveResultMessage(1, false)).toBe(
      "Moved 1 book back to the library.",
    )
  })

  it("builds the request", () => {
    expect(buildArchiveRequest(["x"], true)).toEqual({
      url: "/books/archive",
      body: { books: ["x"], archived: true },
    })
  })
})

describe("archiveErrorMessage", () => {
  it("explains permission and network errors", () => {
    expect(archiveErrorMessage({ status: 403 })).toBe(
      "You do not have permission to change the library.",
    )
    expect(archiveErrorMessage({ status: "FETCH_ERROR" })).toBe(
      "Could not reach the server.",
    )
    expect(archiveErrorMessage(new Error("x"))).toBe(
      "Something went wrong. Try again.",
    )
  })
})
