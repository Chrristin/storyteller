import assert from "node:assert/strict"

import { test } from "vitest"

import {
  type SelectedRef,
  type TargetBook,
  addErrorMessage,
  authorConfirmMessage,
  buildAddRequest,
  buildCreateCollectionRequest,
  buildSeriesRelations,
  buildTargets,
  createButtonLabel,
  filterTargets,
  findTarget,
  groupSelectedByServer,
  planAdd,
  sheetTitle,
  summarizeAdd,
} from "./addToCollection"

function book(
  uuid: string,
  serverUuid: string | null,
  extra: Partial<TargetBook> = {},
): TargetBook {
  return {
    uuid,
    serverUuid,
    authors: [],
    series: [],
    tags: [],
    collections: [],
    ...extra,
  }
}

const library: TargetBook[] = [
  book("b1", "s1", {
    authors: [{ uuid: "a1", name: "J.R.R. Tolkien" }],
    series: [{ uuid: "se1", name: "Lord of the Rings", position: 1 }],
    tags: [{ uuid: "t1", name: "Epic fantasy" }],
    collections: [{ uuid: "c1", name: "Tolkien shelf" }],
  }),
  book("b2", "s1", {
    authors: [{ uuid: "a2", name: "J. R. R. Tolkien" }],
    series: [{ uuid: "se1", name: "Lord of the Rings", position: 2 }],
  }),
  book("b3", "s1", {
    series: [{ uuid: "se2", name: "Loose", position: null }],
  }),
  book("b4", "s2", {
    series: [{ uuid: "se9", name: "The Lord of the Rings", position: 3 }],
  }),
  book("local", null, {
    series: [{ uuid: "se5", name: "Ignored", position: 1 }],
  }),
]

test("buildTargets lists every kind with counts and merges spellings", () => {
  const targets = buildTargets(library, [
    { uuid: "c2", name: "Empty list", serverUuid: "s1" },
  ])
  const byId = new Map(targets.map((t) => [t.id, t]))
  assert.equal(byId.get("author:jrr tolkien")?.count, 2)
  assert.equal(byId.get("collection:empty list")?.count, 0)
  assert.equal(byId.get("genre:epic fantasy")?.count, 1)
  assert.equal(byId.has("series:ignored"), false)
  const series = byId.get("series:lord of the rings")
  assert.equal(series?.count, 3)
  assert.deepEqual(series?.refs.map((r) => [r.serverUuid, r.uuid]).sort(), [
    ["s1", "se1"],
    ["s2", "se9"],
  ])
})

test("filterTargets filters by kind and search, sorted by name", () => {
  const targets = buildTargets(library)
  assert.deepEqual(
    filterTargets(targets, "series", "").map((t) => t.name),
    ["Loose", "Lord of the Rings"],
  )
  assert.deepEqual(
    filterTargets(targets, "all", "tolkien").map((t) => t.kind),
    ["author", "collection"],
  )
  assert.deepEqual(filterTargets(targets, "genre", "zzz"), [])
})

test("findTarget matches names loosely", () => {
  const targets = buildTargets(library)
  assert.equal(
    findTarget(targets, "series", "the lord of the rings")?.id,
    "series:lord of the rings",
  )
  assert.equal(findTarget(targets, "genre", "  "), null)
})

test("groupSelectedByServer skips books without a server", () => {
  const selected: SelectedRef[] = [
    { uuid: "a", title: "A", serverUuid: "s1" },
    { uuid: "b", title: "B", serverUuid: "s2" },
    { uuid: "c", title: "C", serverUuid: null },
    { uuid: "d", title: "D", serverUuid: "s1" },
  ]
  const { servers, skipped } = groupSelectedByServer(selected)
  assert.deepEqual(
    servers.get("s1")?.map((b) => b.uuid),
    ["a", "d"],
  )
  assert.deepEqual(
    skipped.map((b) => b.uuid),
    ["c"],
  )
})

test("buildSeriesRelations numbers a new series from 1", () => {
  assert.deepEqual(buildSeriesRelations(["x", "y", "z"]), [
    { bookUuid: "x", position: 1, featured: false },
    { bookUuid: "y", position: 2, featured: false },
    { bookUuid: "z", position: 3, featured: false },
  ])
})

test("buildSeriesRelations continues after the highest whole position", () => {
  const relations = buildSeriesRelations(["x", "y"], [1, 4, 2.5, null])
  assert.deepEqual(
    relations.map((r) => r.position),
    [5, 6],
  )
})

const selected: SelectedRef[] = [
  { uuid: "b2", title: "Two", serverUuid: "s1" },
  { uuid: "b3", title: "Three", serverUuid: "s1" },
  { uuid: "b4", title: "Four", serverUuid: "s2" },
  { uuid: "local", title: "Local", serverUuid: null },
]

test("planAdd for an existing series appends and skips members", () => {
  const targets = buildTargets(library)
  const target = findTarget(targets, "series", "Lord of the Rings")
  const { plans, skipped } = planAdd({
    kind: "series",
    name: "",
    target,
    selected,
    books: library,
  })
  assert.equal(skipped.length, 1)
  const s1 = plans.find((p) => p.serverUuid === "s1")
  // b2 is already in the series, b3 is new and goes after position 2.
  assert.deepEqual(s1?.bookUuids, ["b3"])
  assert.equal(s1?.alreadyIn, 1)
  assert.deepEqual(
    s1?.relations.map((r) => r.position),
    [3],
  )
  assert.equal(s1?.ref?.uuid, "se1")
  const s2 = plans.find((p) => p.serverUuid === "s2")
  assert.equal(s2?.bookUuids.length, 0)
  assert.equal(s2?.alreadyIn, 1)
})

test("planAdd for a new series numbers in selection order", () => {
  const { plans } = planAdd({
    kind: "series",
    name: " Brand new ",
    target: null,
    selected: selected.slice(0, 2),
    books: library,
  })
  const plan = plans[0]
  assert.equal(plan?.ref, null)
  assert.equal(plan?.name, "Brand new")
  assert.deepEqual(
    plan?.relations.map((r) => [r.bookUuid, r.position]),
    [
      ["b2", 1],
      ["b3", 2],
    ],
  )
})

test("buildAddRequest maps each kind to its server route", () => {
  const plan = {
    serverUuid: "s1",
    ref: { serverUuid: "s1", uuid: "u1", name: "Thing" },
    name: "Thing",
    bookUuids: ["b1", "b2"],
    alreadyIn: 0,
    relations: buildSeriesRelations(["b1", "b2"]),
  }
  assert.deepEqual(buildAddRequest("collection", plan), {
    method: "POST",
    url: "/collections/books",
    body: { collections: ["u1"], books: ["b1", "b2"] },
  })
  assert.equal(
    buildAddRequest("collection", { ...plan, ref: null }, "made")?.url,
    "/collections/books",
  )
  assert.equal(buildAddRequest("collection", { ...plan, ref: null }), null)
  assert.deepEqual(buildAddRequest("series", plan)?.body, {
    series: { uuid: "u1", name: "Thing" },
    relations: plan.relations,
  })
  assert.deepEqual(buildAddRequest("series", { ...plan, ref: null })?.body, {
    series: { name: "Thing" },
    relations: plan.relations,
  })
  assert.deepEqual(buildAddRequest("genre", plan), {
    method: "POST",
    url: "/books/tags",
    body: { tags: [{ name: "Thing" }], books: ["b1", "b2"] },
  })
  assert.deepEqual(buildAddRequest("author", plan), {
    method: "POST",
    url: "/books/creators",
    body: { creators: [{ name: "Thing" }], books: ["b1", "b2"], role: "aut" },
  })
  assert.equal(buildAddRequest("genre", { ...plan, bookUuids: [] }), null)
  assert.deepEqual(buildCreateCollectionRequest(" Mine "), {
    method: "POST",
    url: "/collections",
    body: { name: "Mine", description: "", public: false },
  })
})

test("text helpers", () => {
  assert.equal(sheetTitle(3), "Add 3 books to")
  assert.equal(sheetTitle(1), "Add 1 book to")
  assert.equal(createButtonLabel(3), "Create and add 3 books")
  assert.equal(
    authorConfirmMessage("Ann Leckie", 2),
    "This adds Ann Leckie as an author of 2 books. It changes their metadata.",
  )
  assert.equal(
    summarizeAdd({
      added: 3,
      alreadyIn: 0,
      skipped: 0,
      name: "Lord of the Rings",
    }),
    "Added 3 books to Lord of the Rings.",
  )
  assert.equal(
    summarizeAdd({ added: 0, alreadyIn: 2, skipped: 1, name: "X" }),
    "Nothing to add to X. 2 were already in it. 1 book only on this phone, left out.",
  )
})

test("addErrorMessage covers permission, duplicate and offline", () => {
  assert.match(addErrorMessage({ status: 403 }, "series"), /permission/)
  assert.match(addErrorMessage({ status: 403 }, "collection"), /collections/)
  assert.equal(
    addErrorMessage({ status: 409 }, "collection", "Mine"),
    'A collection named "Mine" already exists.',
  )
  assert.equal(
    addErrorMessage({ status: "FETCH_ERROR" }, "genre"),
    "Could not reach the server.",
  )
  assert.equal(
    addErrorMessage(null, "genre"),
    "Something went wrong. Try again.",
  )
})
