import assert from "node:assert"

import { describe, it } from "vitest"

import { seedBooks, setupTestDb } from "@/__tests__/harness/testDb"
import {
  beginGoogleDriveSignIn,
  disconnectGoogleDrive,
  getBookDriveFiles,
  getGoogleDriveCredentials,
  getGoogleDriveStatus,
  recordBookDriveFile,
  saveGoogleDriveClient,
  saveGoogleDriveSignIn,
  takeGoogleDriveSignIn,
} from "@/database/googleDrive"
import { isEncrypted } from "@/secrets"
import { type UUID } from "@/uuid"

function storedRow(ctx: ReturnType<typeof setupTestDb>) {
  return ctx.sqlite
    .prepare(`SELECT * FROM google_drive_config WHERE id = 1`)
    .get() as Record<string, string | null>
}

describe("google drive settings", () => {
  it("stores the client secret and the sign-in token encrypted", async () => {
    using ctx = setupTestDb()
    await saveGoogleDriveClient("client-id", "client-secret-value")
    await saveGoogleDriveSignIn("refresh-token-value", "me@example.com")

    const row = storedRow(ctx)
    assert.ok(isEncrypted(row["client_secret"] ?? ""))
    assert.ok(isEncrypted(row["refresh_token"] ?? ""))
    assert.ok(!JSON.stringify(row).includes("client-secret-value"))
    assert.ok(!JSON.stringify(row).includes("refresh-token-value"))

    const credentials = await getGoogleDriveCredentials()
    assert.strictEqual(credentials?.clientSecret, "client-secret-value")
    assert.strictEqual(credentials?.refreshToken, "refresh-token-value")
  })

  it("never reports the secret or the token in the status", async () => {
    using _ctx = setupTestDb()
    await saveGoogleDriveClient("client-id", "client-secret-value")
    await saveGoogleDriveSignIn("refresh-token-value", "me@example.com")

    const status = await getGoogleDriveStatus()
    assert.deepStrictEqual(status, {
      configured: true,
      connected: true,
      accountEmail: "me@example.com",
      clientId: "client-id",
    })
    assert.ok(!JSON.stringify(status).includes("secret-value"))
    assert.ok(!JSON.stringify(status).includes("refresh-token"))
  })

  it("accepts a sign-in state once and only once", async () => {
    using _ctx = setupTestDb()
    await saveGoogleDriveClient("client-id", "secret")
    const state = await beginGoogleDriveSignIn("https://books.example/cb")

    assert.strictEqual(await takeGoogleDriveSignIn("wrong"), null)
    // The wrong guess used the state up, so the real one no longer works.
    assert.strictEqual(await takeGoogleDriveSignIn(state), null)

    const second = await beginGoogleDriveSignIn("https://books.example/cb")
    assert.deepStrictEqual(await takeGoogleDriveSignIn(second), {
      redirectUri: "https://books.example/cb",
    })
    assert.strictEqual(await takeGoogleDriveSignIn(second), null)
  })

  it("forgets the sign-in on disconnect but keeps the client", async () => {
    using _ctx = setupTestDb()
    await saveGoogleDriveClient("client-id", "secret")
    await saveGoogleDriveSignIn("token", "me@example.com")
    await disconnectGoogleDrive()

    const status = await getGoogleDriveStatus()
    assert.strictEqual(status.configured, true)
    assert.strictEqual(status.connected, false)
  })

  it("replacing the client forgets the old sign-in", async () => {
    using _ctx = setupTestDb()
    await saveGoogleDriveClient("client-id", "secret")
    await saveGoogleDriveSignIn("token", "me@example.com")
    await saveGoogleDriveClient("other-id", "other-secret")

    const status = await getGoogleDriveStatus()
    assert.strictEqual(status.connected, false)
    assert.strictEqual(status.clientId, "other-id")
  })

  it("remembers which books were copied and drops them with the book", async () => {
    using ctx = setupTestDb()
    const [bookUuid] = seedBooks(ctx, [
      { title: "Dune", ebook: "dune.epub" },
    ]) as [UUID]
    await recordBookDriveFile(bookUuid, "file-1", "Dune.epub")
    await recordBookDriveFile(bookUuid, "file-2", "Dune - Frank Herbert.epub")

    const files = await getBookDriveFiles([bookUuid])
    assert.strictEqual(files.get(bookUuid)?.driveFileId, "file-2")

    ctx.sqlite.prepare(`DELETE FROM book WHERE uuid = ?`).run(bookUuid)
    assert.strictEqual((await getBookDriveFiles([bookUuid])).size, 0)
  })
})
