import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { test } from "vitest"

// lib/nameKey.ts is a copy of the web app's name rules. The two must stay
// identical, so the phone groups names exactly the way the server does.
test("lib/nameKey.ts is identical to applications/web/src/nameKey.ts", () => {
  const read = (relative: string) =>
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")
  assert.equal(read("./nameKey.ts"), read("../../web/src/nameKey.ts"))
})
