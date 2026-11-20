import assert from "node:assert"

import { describe, it } from "vitest"

import {
  type DuplicateCandidate,
  countArchivable,
  groupDuplicates,
  titleKey,
  validateArchiveRequest,
} from "@/duplicates"

let n = 0
function book(
  title: string,
  authors: string[],
  extra: Partial<DuplicateCandidate> & { size?: number; format?: string } = {},
): DuplicateCandidate {
  n++
  const { size = 1000, format = "ebook", ...rest } = extra
  return {
    uuid: `b${n}`,
    title,
    authors,
    createdAt: `2024-01-${String(10 + n).padStart(2, "0")} 00:00:00`,
    ...(format === "ebook" || format === "both"
      ? { ebook: { filepath: `/lib/${n}.epub`, fileSize: size } }
      : {}),
    ...(format === "audiobook" || format === "both"
      ? { audiobook: { filepath: `/lib/${n}`, fileSize: size } }
      : {}),
    ...rest,
  }
}

describe("titleKey", () => {
  it("drops brackets, publisher and year brackets and article", () => {
    assert.strictEqual(titleKey("Hobbit [ill. Lee]"), "hobbit")
    assert.strictEqual(titleKey("The Hobbit"), "hobbit")
    assert.strictEqual(
      titleKey("Hobbit_ Enhanced Edition [with AUDIO]"),
      "hobbit",
    )
    assert.strictEqual(titleKey("Dune (Unabridged)"), "dune")
    assert.strictEqual(titleKey("Dune (HarperCollins, 2012)"), "dune")
    assert.strictEqual(titleKey("Café Society: 2nd Edition"), "cafe society")
    assert.strictEqual(titleKey("Emma - Illustrated Edition"), "emma")
  })

  it("keeps numbers apart", () => {
    assert.notStrictEqual(titleKey("Book 1"), titleKey("Book 2"))
    assert.notStrictEqual(titleKey("Saga (Book 1)"), titleKey("Saga (Book 2)"))
    assert.notStrictEqual(titleKey("Saga #1"), titleKey("Saga #2"))
  })
})

describe("groupDuplicates", () => {
  it("groups three Hobbit editions and keeps the largest", () => {
    const a = book("Hobbit [ill. Lee]", ["J.R.R. Tolkien"], { size: 4_100_000 })
    const b = book("Hobbit [ill. Tolkien]", ["J R R Tolkien"], {
      size: 3_600_000,
    })
    const c = book(
      "Hobbit_ Enhanced Edition [with AUDIO]",
      ["J.R.R. Tolkien"],
      {
        size: 3_000_000,
      },
    )
    const groups = groupDuplicates([b, a, c])
    assert.strictEqual(groups.length, 1)
    assert.strictEqual(groups[0]?.keeperUuid, a.uuid)
    assert.strictEqual(groups[0]?.books.length, 3)
    assert.strictEqual(countArchivable(groups), 2)
  })

  it("groups two Silmarillion editions", () => {
    const a = book(
      "Silmarillion [ed. C. Tolkien, ill. Nasmith]",
      ["J.R.R. Tolkien"],
      {
        size: 2_200_000,
      },
    )
    const b = book(
      "Silmarillion [ed. C. Tolkien, ill. author]",
      ["J.R.R. Tolkien"],
      {
        size: 2_000_000,
      },
    )
    const groups = groupDuplicates([a, b])
    assert.strictEqual(groups.length, 1)
    assert.strictEqual(groups[0]?.keeperUuid, a.uuid)
  })

  it("uses the newest as keeper when sizes are equal", () => {
    const old = book("Emma", ["Jane Austen"])
    const recent = book("Emma", ["Jane Austen"], {
      createdAt: "2030-01-01 00:00:00",
    })
    assert.strictEqual(
      groupDuplicates([old, recent])[0]?.keeperUuid,
      recent.uuid,
    )
  })

  it("does not group an ebook with an audiobook of one title", () => {
    const e = book("Emma", ["Jane Austen"], { format: "ebook" })
    const a = book("Emma", ["Jane Austen"], { format: "audiobook" })
    assert.deepStrictEqual(groupDuplicates([e, a]), [])
  })

  it("compares a book with both formats on each format separately", () => {
    const both = book("Emma", ["Jane Austen"], { format: "both" })
    const e = book("Emma", ["Jane Austen"], { format: "ebook" })
    const a = book("Emma", ["Jane Austen"], { format: "audiobook" })
    const groups = groupDuplicates([both, e, a])
    assert.strictEqual(groups.length, 2)
    assert.deepStrictEqual(groups.map((g) => g.format).sort(), [
      "audiobook",
      "ebook",
    ])
  })

  it("does not group Book 1 with Book 2", () => {
    assert.deepStrictEqual(
      groupDuplicates([
        book("Saga Book 1", ["A Writer"]),
        book("Saga Book 2", ["A Writer"]),
      ]),
      [],
    )
  })

  it("does not group differently numbered series entries with one title", () => {
    const groups = groupDuplicates([
      book("Foundation", ["Isaac Asimov"], {
        series: { name: "Foundation", position: 1 },
      }),
      book("Foundation", ["Isaac Asimov"], {
        series: { name: "Foundation", position: 2 },
      }),
    ])
    assert.deepStrictEqual(groups, [])
  })

  it("does not group the same title by different authors", () => {
    assert.deepStrictEqual(
      groupDuplicates([
        book("Home", ["Toni Morrison"]),
        book("Home", ["Marilynne Robinson"]),
      ]),
      [],
    )
  })

  it("ignores archived books and books without an author", () => {
    assert.deepStrictEqual(
      groupDuplicates([
        book("Emma", ["Jane Austen"]),
        book("Emma", ["Jane Austen"], { archivedAt: "2024-01-01 00:00:00" }),
        book("Untitled", []),
        book("Untitled", []),
      ]),
      [],
    )
  })
})

describe("validateArchiveRequest", () => {
  const a = book("Emma", ["Jane Austen"], { size: 2 })
  const b = book("Emma", ["Jane Austen"], { size: 1 })
  const other = book("Persuasion", ["Jane Austen"])
  const groups = groupDuplicates([a, b, other])

  it("accepts a book that is in a group with its keeper", () => {
    const result = validateArchiveRequest(
      [{ keeperUuid: a.uuid, archiveUuids: [b.uuid] }],
      groups,
    )
    assert.deepStrictEqual(result, { ok: true, uuids: [b.uuid] })
  })

  it("refuses an unrelated book", () => {
    const result = validateArchiveRequest(
      [{ keeperUuid: a.uuid, archiveUuids: [other.uuid] }],
      groups,
    )
    assert.strictEqual(result.ok, false)
  })

  it("refuses to archive a book that is kept elsewhere", () => {
    const result = validateArchiveRequest(
      [
        { keeperUuid: a.uuid, archiveUuids: [b.uuid] },
        { keeperUuid: b.uuid, archiveUuids: [a.uuid] },
      ],
      groups,
    )
    assert.strictEqual(result.ok, false)
  })
})
