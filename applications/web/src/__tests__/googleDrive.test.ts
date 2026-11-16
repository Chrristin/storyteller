import assert from "node:assert"

import { describe, it } from "vitest"

import {
  DriveError,
  KOBO_FOLDER_NAME,
  SYNC_FOLDER_NAME,
  buildAuthUrl,
  driveFileName,
  ensureSyncFolder,
  syncBooksToDrive,
  type FetchFn,
  type SyncableBook,
} from "@/googleDrive"
import { type UUID } from "@/uuid"

type Call = { url: string; method: string; body?: string }

/**
 * A tiny fake of the parts of Google Drive this code uses. Folder and file
 * listings are looked up by the query text the code sends.
 */
function fakeDrive(options: {
  koboFolders?: { id: string; name: string }[]
  syncFolders?: { id: string; name: string }[]
  files?: { id: string; name: string }[]
  failUploadFor?: string
}) {
  const calls: Call[] = []
  let created = 0

  const json = (value: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(value), {
      status: 200,
      headers: { "content-type": "application/json" },
      ...init,
    })

  const fetchFn: FetchFn = async (input, init) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    const body = typeof init?.body === "string" ? init.body : undefined
    calls.push({ url, method, ...(body ? { body } : {}) })

    const parsed = new URL(url)
    if (parsed.pathname === "/drive/v3/files" && method === "GET") {
      const q = parsed.searchParams.get("q") ?? ""
      if (q.includes(`name = '${KOBO_FOLDER_NAME}'`)) {
        return json({ files: options.koboFolders ?? [] })
      }
      if (q.includes(`name = '${SYNC_FOLDER_NAME}'`)) {
        return json({ files: options.syncFolders ?? [] })
      }
      const match = (options.files ?? []).filter((file) =>
        q.includes(`name = '${file.name}'`),
      )
      return json({ files: match })
    }

    if (parsed.pathname === "/drive/v3/files" && method === "POST") {
      return json({ id: "new-folder" })
    }

    if (parsed.pathname.startsWith("/upload/drive/v3/files")) {
      const name = (JSON.parse(body ?? "{}") as { name?: string }).name
      if (options.failUploadFor && name === options.failUploadFor) {
        return json({ error: { message: "quota" } }, { status: 403 })
      }
      created += 1
      return new Response(null, {
        status: 200,
        headers: { location: `https://upload.example/session-${created}` },
      })
    }

    if (url.startsWith("https://upload.example/")) {
      return json({ id: `file-${created}` })
    }

    return json({}, { status: 404 })
  }

  return { fetchFn, calls }
}

const book = (title: string, filepath: string | null, author = "Andy Weir") =>
  ({
    uuid: `${title}-uuid` as UUID,
    title,
    authors: [{ name: author }],
    ebook: filepath ? { filepath } : null,
  }) satisfies SyncableBook

const readEpub = async () => Buffer.from("epub bytes")

describe("google drive sync", () => {
  it("builds the sign-in address with offline access and the Drive scope", () => {
    const url = new URL(
      buildAuthUrl({ clientId: "id.apps" }, "https://books.example/cb", "st"),
    )
    assert.strictEqual(
      url.origin + url.pathname,
      "https://accounts.google.com/o/oauth2/v2/auth",
    )
    assert.strictEqual(url.searchParams.get("client_id"), "id.apps")
    assert.strictEqual(url.searchParams.get("access_type"), "offline")
    assert.strictEqual(url.searchParams.get("state"), "st")
    assert.strictEqual(
      url.searchParams.get("scope"),
      "https://www.googleapis.com/auth/drive",
    )
  })

  it("names files Title - Author.epub and strips unsafe characters", () => {
    assert.strictEqual(
      driveFileName({
        uuid: "u" as UUID,
        title: "Dune: Part 1?",
        authors: [{ name: "Frank Herbert" }],
      }),
      "Dune Part 1 - Frank Herbert.epub",
    )
    assert.strictEqual(
      driveFileName({ uuid: "u" as UUID, title: "Dune" }),
      "Dune.epub",
    )
  })

  describe("the Storyteller folder", () => {
    it("refuses to continue when Kobo's folder is missing, and creates nothing", async () => {
      const { fetchFn, calls } = fakeDrive({})
      await assert.rejects(
        () => ensureSyncFolder("token", fetchFn),
        (error) =>
          error instanceof DriveError && error.code === "kobo-folder-missing",
      )
      assert.ok(!calls.some((call) => call.method === "POST"))
    })

    it("refuses to guess when there are two Rakuten Kobo folders", async () => {
      const { fetchFn } = fakeDrive({
        koboFolders: [
          { id: "a", name: KOBO_FOLDER_NAME },
          { id: "b", name: KOBO_FOLDER_NAME },
        ],
      })
      await assert.rejects(
        () => ensureSyncFolder("token", fetchFn),
        (error) =>
          error instanceof DriveError && error.code === "kobo-folder-ambiguous",
      )
    })

    it("creates Storyteller inside Rakuten Kobo when it is missing", async () => {
      const { fetchFn, calls } = fakeDrive({
        koboFolders: [{ id: "kobo", name: KOBO_FOLDER_NAME }],
      })
      assert.strictEqual(await ensureSyncFolder("token", fetchFn), "new-folder")
      const create = calls.find((call) => call.method === "POST")
      assert.ok(create)
      const sent = JSON.parse(create.body ?? "{}") as {
        name: string
        parents: string[]
      }
      assert.strictEqual(sent.name, SYNC_FOLDER_NAME)
      assert.deepStrictEqual(sent.parents, ["kobo"])
    })

    it("reuses Storyteller when it already exists", async () => {
      const { fetchFn, calls } = fakeDrive({
        koboFolders: [{ id: "kobo", name: KOBO_FOLDER_NAME }],
        syncFolders: [{ id: "existing", name: SYNC_FOLDER_NAME }],
      })
      assert.strictEqual(await ensureSyncFolder("token", fetchFn), "existing")
      assert.ok(!calls.some((call) => call.method === "POST"))
    })
  })

  describe("copying books", () => {
    it("uploads a new book and records it", async () => {
      const { fetchFn } = fakeDrive({})
      const recorded: string[] = []
      const results = await syncBooksToDrive(
        [book("Project Hail Mary", "/library/phm.epub")],
        { accessToken: "t", folderId: "folder", overwrite: false },
        {
          fetchFn,
          readEpub,
          record: async (_uuid, id, name) =>
            void recorded.push(`${id}|${name}`),
        },
      )
      assert.strictEqual(results[0]?.status, "sent")
      assert.deepStrictEqual(recorded, [
        "file-1|Project Hail Mary - Andy Weir.epub",
      ])
    })

    it("skips a book that is already in the folder", async () => {
      const { fetchFn, calls } = fakeDrive({
        files: [{ id: "old", name: "Project Hail Mary - Andy Weir.epub" }],
      })
      const results = await syncBooksToDrive(
        [book("Project Hail Mary", "/library/phm.epub")],
        { accessToken: "t", folderId: "folder", overwrite: false },
        { fetchFn, readEpub },
      )
      assert.strictEqual(results[0]?.status, "skipped")
      assert.ok(!calls.some((call) => call.url.includes("/upload/")))
    })

    it("replaces an existing file only when overwrite is on", async () => {
      const { fetchFn, calls } = fakeDrive({
        files: [{ id: "old", name: "Project Hail Mary - Andy Weir.epub" }],
      })
      const results = await syncBooksToDrive(
        [book("Project Hail Mary", "/library/phm.epub")],
        { accessToken: "t", folderId: "folder", overwrite: true },
        { fetchFn, readEpub },
      )
      assert.strictEqual(results[0]?.status, "replaced")
      const start = calls.find((call) => call.url.includes("/upload/"))
      assert.strictEqual(start?.method, "PATCH")
      assert.ok(start?.url.includes("/files/old"))
    })

    it("never sends an _epub2 copy or a book with no ebook", async () => {
      const { fetchFn, calls } = fakeDrive({})
      const results = await syncBooksToDrive(
        [
          book("Parallels", "/library/Parallels - Bobmin_epub2.epub"),
          book("Audio only", null),
        ],
        { accessToken: "t", folderId: "folder", overwrite: false },
        { fetchFn, readEpub },
      )
      assert.deepStrictEqual(
        results.map((result) => result.status),
        ["failed", "failed"],
      )
      assert.ok(!calls.some((call) => call.url.includes("/upload/")))
    })

    it("keeps going when one book fails", async () => {
      const { fetchFn } = fakeDrive({ failUploadFor: "Bad - Andy Weir.epub" })
      const results = await syncBooksToDrive(
        [book("Bad", "/library/bad.epub"), book("Good", "/library/good.epub")],
        { accessToken: "t", folderId: "folder", overwrite: false },
        { fetchFn, readEpub },
      )
      assert.deepStrictEqual(
        results.map((result) => result.status),
        ["failed", "sent"],
      )
    })
  })
})
