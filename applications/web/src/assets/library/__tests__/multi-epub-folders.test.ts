import assert from "node:assert"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, it } from "vitest"
import { ZipFile } from "yazl"

import { setupTestDb } from "@/__tests__/harness/testDb"
import { createTestLibrary } from "@/__tests__/harness/testFs"
import {
  canonicalizePath,
  listBookCandidates,
} from "@/assets/library/scanner/folder"
import { scanLibrary } from "@/assets/library/scanner/scan"
import { type BookWithRelations, getBooks } from "@/database/books"
import { createImportRule } from "@/database/importRules"

const SIGNAL = () => ({ signal: new AbortController().signal })

/** a minimal EPUB 3 whose manifest has a media overlay, so it classifies as readaloud */
async function buildReadaloudEpub(): Promise<Buffer> {
  const zip = new ZipFile()
  zip.addBuffer(Buffer.from("application/epub+zip"), "mimetype", {
    compress: false,
  })
  zip.addBuffer(
    Buffer.from(
      `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    ),
    "META-INF/container.xml",
  )
  zip.addBuffer(
    Buffer.from(
      `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" unique-identifier="uid" version="3.0">
  <metadata>
    <dc:title>Aligned</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uid">aligned-uid</dc:identifier>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" media-overlay="overlay"/>
    <item id="overlay" href="chapter.smil" media-type="application/smil+xml"/>
  </manifest>
  <spine><itemref idref="chapter"/></spine>
</package>`,
    ),
    "content.opf",
  )
  zip.addBuffer(Buffer.from("<html/>"), "chapter.xhtml")
  zip.addBuffer(Buffer.from("<smil/>"), "chapter.smil")
  zip.end()
  const chunks: Buffer[] = []
  for await (const chunk of zip.outputStream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** a small EPUB 2 file; the "replace" strategy converts it on import */
async function buildEpub2(uid: string, title: string): Promise<Buffer> {
  const zip = new ZipFile()
  zip.addBuffer(Buffer.from("application/epub+zip"), "mimetype", {
    compress: false,
  })
  const add = (name: string, body: string) =>
    zip.addBuffer(Buffer.from(body), name)
  add(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  )
  add(
    "content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" unique-identifier="uid" version="2.0">
  <metadata><dc:title>${title}</dc:title><dc:language>en</dc:language><dc:identifier id="uid">${uid}</dc:identifier></metadata>
  <manifest>
    <item href="chapter.xhtml" id="chapter" media-type="application/xhtml+xml" />
    <item href="toc.ncx" id="ncx" media-type="application/x-dtbncx+xml" />
  </manifest>
  <spine toc="ncx"><itemref idref="chapter" /></spine>
</package>`,
  )
  add(
    "chapter.xhtml",
    `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head><body><h1>One</h1><p>Hello.</p></body></html>`,
  )
  add(
    "toc.ncx",
    `<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uid}"/></head><docTitle><text>${title}</text></docTitle><navMap><navPoint id="np1" playOrder="1"><navLabel><text>One</text></navLabel><content src="chapter.xhtml"/></navPoint></navMap></ncx>`,
  )
  zip.end()
  const chunks: Buffer[] = []
  for await (const chunk of zip.outputStream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

function fakeBook(paths: {
  ebook?: string
  readaloud?: string
  audiobook?: string
}): BookWithRelations {
  return {
    uuid: "11111111-1111-1111-1111-111111111111",
    ebook: paths.ebook ? { filepath: paths.ebook } : null,
    readaloud: paths.readaloud ? { filepath: paths.readaloud } : null,
    audiobook: paths.audiobook ? { filepath: paths.audiobook } : null,
  } as unknown as BookWithRelations
}

async function makeFolder(opts: {
  epubs?: string[]
  readalouds?: string[]
  audio?: string[]
}) {
  const library = await createTestLibrary("multi-epub")
  const folder = await library.createBookFolder("author", {
    dummyAudio: opts.audio ?? [],
  })
  for (const name of opts.epubs ?? []) await folder.add(name, "")
  for (const name of opts.readalouds ?? []) {
    await writeFile(join(folder.path, name), await buildReadaloudEpub())
  }
  return { library, path: await canonicalizePath(folder.path) }
}

const summary = (cs: { format: string; filepath: string }[]) =>
  cs.map((c) => `${c.format}:${c.filepath.split("/").pop()}`).sort()

describe("multi-epub folders", () => {
  it("skip mode ignores a folder with several epubs", async () => {
    using _db = setupTestDb()
    const { library, path } = await makeFolder({
      epubs: ["a.epub", "b.epub", "c.epub"],
    })
    await using _lib = library
    const out = await listBookCandidates({ folder: path, books: [] }, SIGNAL())
    assert.deepStrictEqual(out, [])
  })

  it("skip mode keeps only existing books in a multi-epub folder", async () => {
    using _db = setupTestDb()
    const { library, path } = await makeFolder({
      epubs: ["a.epub", "b.epub", "c.epub"],
    })
    await using _lib = library
    const books = [fakeBook({ ebook: join(path, "a.epub") })]
    const out = await listBookCandidates({ folder: path, books }, SIGNAL())
    assert.deepStrictEqual(summary(out), ["ebook:a.epub"])
  })

  it("separate-books gives one ebook candidate per epub", async () => {
    using _db = setupTestDb({ multiEpubFolderStrategy: "separate-books" })
    const { library, path } = await makeFolder({
      epubs: ["a.epub", "b.epub", "c.epub"],
    })
    await using _lib = library
    const out = await listBookCandidates(
      { folder: path, books: [], importMode: "reference" },
      SIGNAL(),
    )
    assert.deepStrictEqual(summary(out), [
      "ebook:a.epub",
      "ebook:b.epub",
      "ebook:c.epub",
    ])
    for (const c of out) {
      assert.strictEqual(c.existingBook, undefined)
      assert.strictEqual(c.standalone, true)
      assert.strictEqual(c.importMode, "reference")
    }
  })

  it("separate-books does not emit known epubs as new books", async () => {
    using _db = setupTestDb({ multiEpubFolderStrategy: "separate-books" })
    const { library, path } = await makeFolder({
      epubs: ["a.epub", "b.epub", "c.epub"],
    })
    await using _lib = library
    const known = fakeBook({ ebook: join(path, "a.epub") })
    const out = await listBookCandidates(
      { folder: path, books: [known] },
      SIGNAL(),
    )
    assert.deepStrictEqual(summary(out), [
      "ebook:a.epub",
      "ebook:b.epub",
      "ebook:c.epub",
    ])
    const a = out.find((c) => c.filepath.endsWith("a.epub"))
    assert.strictEqual(a?.existingBook, known)
    assert.strictEqual(a.standalone, undefined)
    for (const c of out.filter((c) => !c.filepath.endsWith("a.epub"))) {
      assert.strictEqual(c.existingBook, undefined)
    }
  })

  it("separate-books with audio and several epubs emits no audiobook", async () => {
    using _db = setupTestDb({ multiEpubFolderStrategy: "separate-books" })
    const { library, path } = await makeFolder({
      epubs: ["a.epub", "b.epub"],
      audio: ["track1.mp3"],
    })
    await using _lib = library
    const out = await listBookCandidates({ folder: path, books: [] }, SIGNAL())
    assert.deepStrictEqual(summary(out), ["ebook:a.epub", "ebook:b.epub"])
  })

  it("separate-books with audio and one epub still pairs them", async () => {
    using _db = setupTestDb({ multiEpubFolderStrategy: "separate-books" })
    const { library, path } = await makeFolder({
      epubs: ["a.epub"],
      audio: ["track1.mp3"],
    })
    await using _lib = library
    const out = await listBookCandidates({ folder: path, books: [] }, SIGNAL())
    assert.deepStrictEqual(summary(out), ["audiobook:author", "ebook:a.epub"])
    for (const c of out) assert.strictEqual(c.standalone, undefined)
  })

  it("separate-books splits readaloud and regular epubs", async () => {
    using _db = setupTestDb({ multiEpubFolderStrategy: "separate-books" })
    const { library, path } = await makeFolder({
      epubs: ["a.epub", "b.epub"],
      readalouds: ["c.epub"],
    })
    await using _lib = library
    const out = await listBookCandidates({ folder: path, books: [] }, SIGNAL())
    assert.deepStrictEqual(summary(out), [
      "ebook:a.epub",
      "ebook:b.epub",
      "readaloud:c.epub",
    ])
    assert.ok(out.every((c) => c.standalone && !c.existingBook))
  })

  it("ignores epub2 backups next to many converted files", async () => {
    using _db = setupTestDb({ multiEpubFolderStrategy: "separate-books" })
    const { library, path } = await makeFolder({
      epubs: ["a.epub", "a_epub2.epub", "b.epub", "b_epub2.epub"],
    })
    await using _lib = library
    const out = await listBookCandidates({ folder: path, books: [] }, SIGNAL())
    assert.deepStrictEqual(summary(out), ["ebook:a.epub", "ebook:b.epub"])
  })

  it("a scan imports every epub in the folder as its own book", async () => {
    using _db = setupTestDb({
      multiEpubFolderStrategy: "separate-books",
      epub2ImportStrategy: "replace",
    })
    await using library = await createTestLibrary("multi-epub-scan")
    const folder = await library.createBookFolder("author")
    const titles = ["Alpha Tale", "Beta Tale", "Gamma Tale"]
    for (const [i, title] of titles.entries()) {
      await folder.add(`${title}.epub`, await buildEpub2(`uid-${i}`, title))
    }
    await createImportRule({
      kind: "watch",
      path: await canonicalizePath(library.root),
      importMode: "reference",
    })

    const signal = new AbortController().signal
    await scanLibrary({ source: "manual", signal })
    const books = await getBooks()
    assert.deepStrictEqual(books.map((b) => b.title).sort(), titles)
    assert.strictEqual(new Set(books.map((b) => b.ebook?.filepath)).size, 3)

    // a second scan keeps the same three books
    await scanLibrary({ source: "manual", signal })
    assert.strictEqual((await getBooks()).length, 3)
  })
})
