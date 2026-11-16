import assert from "node:assert"
import { randomUUID } from "node:crypto"

import { describe, it } from "vitest"

import { seedBooks, setupTestDb } from "@/__tests__/harness/testDb"
import {
  beginGoogleDriveSignIn,
  disconnectGoogleDrive,
  getBookDriveFiles,
  getGoogleDriveCredentials,
  getGoogleDriveStatus,
  recordBookDriveFile,
  removeGoogleDrive,
  saveGoogleDriveClient,
  saveGoogleDriveSignIn,
  takeGoogleDriveSignIn,
} from "@/database/googleDrive"
import { isEncrypted } from "@/secrets"
import { type UUID } from "@/uuid"

function addUser(ctx: ReturnType<typeof setupTestDb>, username: string): UUID {
  const permission = ctx.sqlite
    .prepare(`INSERT INTO user_permission DEFAULT VALUES RETURNING uuid`)
    .get() as { uuid: string }
  const user = ctx.sqlite
    .prepare(
      `INSERT INTO user (user_permission_uuid, email, name, username) VALUES (?, ?, ?, ?) RETURNING id`,
    )
    .get(
      permission.uuid,
      `${randomUUID()}@example.com`,
      username,
      username,
    ) as {
    id: string
  }
  return user.id as UUID
}

describe("google drive settings", () => {
  it("stores the client secret and each sign-in token encrypted", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "christin")
    await saveGoogleDriveClient("client-id", "client-secret-value")
    await saveGoogleDriveSignIn(
      christin,
      "refresh-token-value",
      "me@example.com",
    )

    const clientRow = ctx.sqlite
      .prepare(`SELECT * FROM google_drive_config WHERE id = 1`)
      .get() as Record<string, string | null>
    const connectionRow = ctx.sqlite
      .prepare(`SELECT * FROM google_drive_connection WHERE user_id = ?`)
      .get(christin) as Record<string, string | null>
    assert.ok(isEncrypted(clientRow["client_secret"] ?? ""))
    assert.ok(isEncrypted(connectionRow["refresh_token"] ?? ""))
    const stored = JSON.stringify([clientRow, connectionRow])
    assert.ok(!stored.includes("client-secret-value"))
    assert.ok(!stored.includes("refresh-token-value"))

    const credentials = await getGoogleDriveCredentials(christin)
    assert.strictEqual(credentials?.clientSecret, "client-secret-value")
    assert.strictEqual(credentials?.refreshToken, "refresh-token-value")
  })

  it("keeps each user's connection to themselves", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "christin")
    const wife = addUser(ctx, "wife")
    await saveGoogleDriveClient("client-id", "secret")
    await saveGoogleDriveSignIn(christin, "token", "christin@example.com")

    assert.deepStrictEqual(await getGoogleDriveStatus(christin), {
      configured: true,
      connected: true,
      accountEmail: "christin@example.com",
    })
    // The other user can see that Drive is set up, but is not connected.
    assert.deepStrictEqual(await getGoogleDriveStatus(wife), {
      configured: true,
      connected: false,
      accountEmail: null,
    })
    assert.strictEqual(
      (await getGoogleDriveCredentials(wife))?.refreshToken,
      null,
    )
  })

  it("never reports a secret or a token in the status", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "christin")
    await saveGoogleDriveClient("client-id", "client-secret-value")
    await saveGoogleDriveSignIn(
      christin,
      "refresh-token-value",
      "me@example.com",
    )

    const status = JSON.stringify(await getGoogleDriveStatus(christin))
    assert.ok(!status.includes("secret-value"))
    assert.ok(!status.includes("refresh-token"))
  })

  it("accepts a sign-in state once, and only for the user who started it", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "christin")
    const wife = addUser(ctx, "wife")
    await saveGoogleDriveClient("client-id", "secret")

    const state = await beginGoogleDriveSignIn(
      christin,
      "https://books.example/cb",
    )
    // Another user cannot finish christin's sign-in with his state.
    assert.strictEqual(await takeGoogleDriveSignIn(wife, state), null)
    assert.deepStrictEqual(await takeGoogleDriveSignIn(christin, state), {
      redirectUri: "https://books.example/cb",
    })
    assert.strictEqual(await takeGoogleDriveSignIn(christin, state), null)

    // A wrong guess uses the state up.
    const second = await beginGoogleDriveSignIn(
      christin,
      "https://books.example/cb",
    )
    assert.strictEqual(await takeGoogleDriveSignIn(christin, "wrong"), null)
    assert.strictEqual(await takeGoogleDriveSignIn(christin, second), null)
  })

  it("disconnecting one user does not touch another", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "christin")
    const wife = addUser(ctx, "wife")
    await saveGoogleDriveClient("client-id", "secret")
    await saveGoogleDriveSignIn(christin, "t1", "christin@example.com")
    await saveGoogleDriveSignIn(wife, "t2", "wife@example.com")
    await disconnectGoogleDrive(christin)

    assert.strictEqual((await getGoogleDriveStatus(christin)).connected, false)
    assert.strictEqual((await getGoogleDriveStatus(christin)).configured, true)
    assert.strictEqual((await getGoogleDriveStatus(wife)).connected, true)
  })

  it("replacing the client signs everyone out", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "christin")
    await saveGoogleDriveClient("client-id", "secret")
    await saveGoogleDriveSignIn(christin, "token", "me@example.com")
    await saveGoogleDriveClient("other-id", "other-secret")

    assert.strictEqual((await getGoogleDriveStatus(christin)).connected, false)
  })

  it("removing the client removes every connection", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "christin")
    await saveGoogleDriveClient("client-id", "secret")
    await saveGoogleDriveSignIn(christin, "token", "me@example.com")
    await removeGoogleDrive()

    assert.deepStrictEqual(await getGoogleDriveStatus(christin), {
      configured: false,
      connected: false,
      accountEmail: null,
    })
  })

  it("remembers copied books per user, and drops them with the book", async () => {
    using ctx = setupTestDb()
    const christin = addUser(ctx, "christin")
    const wife = addUser(ctx, "wife")
    const [bookUuid] = seedBooks(ctx, [
      { title: "Dune", ebook: "dune.epub" },
    ]) as [UUID]
    await recordBookDriveFile(christin, bookUuid, "file-1", "Dune.epub")
    await recordBookDriveFile(
      christin,
      bookUuid,
      "file-2",
      "Dune - Frank Herbert.epub",
    )

    const mine = await getBookDriveFiles(christin, [bookUuid])
    assert.strictEqual(mine.get(bookUuid)?.driveFileId, "file-2")
    // The other user never copied it.
    assert.strictEqual((await getBookDriveFiles(wife, [bookUuid])).size, 0)

    ctx.sqlite.prepare(`DELETE FROM book WHERE uuid = ?`).run(bookUuid)
    assert.strictEqual((await getBookDriveFiles(christin, [bookUuid])).size, 0)
  })
})
