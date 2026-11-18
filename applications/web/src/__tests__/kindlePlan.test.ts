import assert from "node:assert"

import { describe, it } from "vitest"

import { KINDLE_MAX_BYTES, planKindleEmails } from "@/kindle"

const book = (name: string, bytes: number) => ({ name, bytes })
const names = (emails: { name: string }[][]) =>
  emails.map((email) => email.map((b) => b.name))

describe("planKindleEmails", () => {
  it("puts books under the limit in one email", () => {
    const plan = planKindleEmails([book("a", 5e6), book("b", 5e6)])
    assert.deepStrictEqual(names(plan.emails), [["a", "b"]])
    assert.strictEqual(plan.oversized.length, 0)
  })

  it("splits a set over the limit in order", () => {
    const plan = planKindleEmails([
      book("a", 10e6),
      book("b", 10e6),
      book("c", 10e6),
      book("d", 1e6),
    ])
    assert.deepStrictEqual(names(plan.emails), [
      ["a", "b"],
      ["c", "d"],
    ])
  })

  it("accepts an email of exactly the limit", () => {
    const plan = planKindleEmails([
      book("a", KINDLE_MAX_BYTES / 2),
      book("b", KINDLE_MAX_BYTES / 2),
    ])
    assert.strictEqual(plan.emails.length, 1)
  })

  it("reports a single oversized book and keeps the rest", () => {
    const plan = planKindleEmails([
      book("a", 1e6),
      book("big", KINDLE_MAX_BYTES + 1),
      book("b", 1e6),
    ])
    assert.deepStrictEqual(names(plan.emails), [["a", "b"]])
    assert.deepStrictEqual(
      plan.oversized.map((b) => b.name),
      ["big"],
    )
  })

  it("caps an email at 25 books", () => {
    const many = Array.from({ length: 30 }, (_, i) => book(`b${i}`, 1))
    const plan = planKindleEmails(many)
    assert.deepStrictEqual(
      plan.emails.map((email) => email.length),
      [25, 5],
    )
  })

  it("returns nothing for no books", () => {
    assert.deepStrictEqual(planKindleEmails([]), { emails: [], oversized: [] })
  })
})
