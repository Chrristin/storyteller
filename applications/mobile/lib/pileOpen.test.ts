import assert from "node:assert/strict"

import { test } from "vitest"

import { decidePileOpen, formatChoices, sheetTitle } from "./pileOpen"

test("nothing downloaded opens the details page", () => {
  assert.deepEqual(decidePileOpen([], undefined), { kind: "details" })
  assert.deepEqual(decidePileOpen([], "ebook", true), { kind: "details" })
})

test("a single format opens directly, audio autoplays", () => {
  assert.deepEqual(decidePileOpen(["ebook"], undefined), {
    kind: "open",
    format: "ebook",
    autoplay: false,
  })
  assert.deepEqual(decidePileOpen(["audiobook"], undefined, true), {
    kind: "open",
    format: "audiobook",
    autoplay: true,
  })
})

test("ebook plus audiobook with no choice asks", () => {
  assert.deepEqual(decidePileOpen(["ebook", "audiobook"], undefined), {
    kind: "ask",
    choices: [
      { format: "ebook", label: "Read" },
      { format: "audiobook", label: "Listen" },
    ],
  })
})

test("a readaloud adds Read along as a third button", () => {
  const d = decidePileOpen(["readaloud", "ebook", "audiobook"], undefined)
  assert.equal(d.kind, "ask")
  if (d.kind === "ask") {
    assert.deepEqual(
      d.choices.map((c) => c.label),
      ["Read", "Read along", "Listen"],
    )
  }
})

test("a remembered openable choice opens without asking", () => {
  assert.deepEqual(decidePileOpen(["ebook", "audiobook"], "audiobook"), {
    kind: "open",
    format: "audiobook",
    autoplay: true,
  })
  assert.deepEqual(decidePileOpen(["ebook", "audiobook"], "ebook"), {
    kind: "open",
    format: "ebook",
    autoplay: false,
  })
})

test("a remembered choice that is no longer openable asks again", () => {
  assert.equal(decidePileOpen(["ebook", "audiobook"], "readaloud").kind, "ask")
})

test("long press asks even with a remembered choice", () => {
  assert.equal(
    decidePileOpen(["ebook", "audiobook"], "ebook", true).kind,
    "ask",
  )
})

test("readaloud plus audiobook without text does not ask", () => {
  assert.deepEqual(decidePileOpen(["readaloud", "audiobook"], undefined), {
    kind: "open",
    format: "readaloud",
    autoplay: true,
  })
})

test("labels and title", () => {
  const choices = formatChoices(["audiobook", "ebook"])
  assert.deepEqual(
    choices.map((c) => c.label),
    ["Read", "Listen"],
  )
  assert.equal(sheetTitle(choices), "Read or listen")
  assert.equal(
    sheetTitle(formatChoices(["readaloud", "ebook", "audiobook"])),
    "Read, read along or listen",
  )
})
