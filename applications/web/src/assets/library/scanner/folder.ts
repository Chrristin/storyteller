import { type Dirent } from "node:fs"
import { readdir, realpath } from "node:fs/promises"
import { basename, extname, join, resolve } from "node:path"

import { Epub, MemoryAdapter } from "@storyteller-platform/epub"
import { isHiddenFile } from "@storyteller-platform/fs"

import { isInsideInternalDirectory } from "@/assets/library/internalDirs"
import { pathBelongsTo } from "@/assets/library/paths"
import { isAudioFile } from "@/audio"
import { type BookWithRelations } from "@/database/books"
import { getIgnorePaths } from "@/database/importRules"
import { getSetting } from "@/database/settings"
import {
  type Epub2ImportStrategy,
  type ImportMode,
  renderEpubSuffix,
} from "@/database/settingsTypes"
import { isEpubFile, isEpubVersionError, isReadaloudEpub } from "@/epub"
import { logger } from "@/logging"

import { type ScanCtx } from "./ctx"
import { type Candidate } from "./types"

/** Resolve symlinks/relative paths to a single canonical form. */
export async function canonicalizePath(p: string): Promise<string> {
  try {
    return await realpath(p)
  } catch {
    return resolve(p)
  }
}

function isENOENT(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

type FolderClassification = {
  regularEpubs: string[]
  readaloudEpubs: string[]
  audiobookDir: string | null
}

async function classifyFolder(
  folder: string,
  opts: { epub2BackupSuffix: string; ignorePaths: string[] },
): Promise<FolderClassification | null> {
  let entries: Dirent[]
  try {
    entries = await readdir(folder, { withFileTypes: true })
  } catch (error) {
    if (isENOENT(error)) return null
    throw error
  }

  const epubPaths: string[] = []
  let hasAudio = false
  const epub2BackupSuffix = renderEpubSuffix(opts.epub2BackupSuffix, 2)
  const epub3BackupSuffix = renderEpubSuffix(opts.epub2BackupSuffix, 3)

  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue

    const name = entry.name
    if (isHiddenFile(name)) continue
    const fullPath = join(folder, name)

    const isInIgnorePath = Array.from(opts.ignorePaths).some((path) =>
      pathBelongsTo(path, fullPath),
    )
    if (isInIgnorePath) continue

    if (isEpubFile(name)) {
      if (name.endsWith(`${epub2BackupSuffix}.epub`)) continue

      // if there is a file in this folder with the same name but with the epub3 backup suffix, add it to the epubPaths
      // ignore this one
      const backedUp = entries.find(
        (entry) =>
          entry.name ===
          `${name.replace(extname(name), "")}${epub3BackupSuffix}.epub`,
      )
      if (backedUp) {
        continue
      }

      epubPaths.push(fullPath)
    } else if (isAudioFile(name)) {
      hasAudio = true
    }
  }

  const regularEpubs: string[] = []
  const readaloudEpubs: string[] = []
  for (const epubPath of epubPaths) {
    let aligned = false
    try {
      using epub = await Epub.using(MemoryAdapter).from(epubPath)
      aligned = await isReadaloudEpub(epub)
    } catch (error) {
      if (isEpubVersionError(error)) {
        logger.warn({
          msg: "Can't classify epub as readaloud or regular ebook because it is an EPUB 2 file, treating as regular and continuing",
          epubPath,
        })
      } else {
        logger.warn({
          msg: "Failed to classify epub as readaloud or regular ebook during folder scan; treating as regular",
          epubPath,
          err: error,
        })
      }
    }
    if (aligned) readaloudEpubs.push(epubPath)
    else regularEpubs.push(epubPath)
  }

  return {
    regularEpubs,
    readaloudEpubs,
    audiobookDir: hasAudio ? folder : null,
  }
}

function booksReferencingFolder(
  folder: string,
  books: BookWithRelations[],
): BookWithRelations[] {
  return books.filter((book) => {
    const paths = [
      book.ebook?.filepath,
      book.audiobook?.filepath,
      book.readaloud?.filepath,
    ].filter((p): p is string => !!p)
    return paths.some((p) => pathBelongsTo(folder, p))
  })
}

function candidateFromExistingBook(
  folder: string,
  book: BookWithRelations,
): Candidate[] {
  const out: Candidate[] = []
  if (book.ebook?.filepath && pathBelongsTo(folder, book.ebook.filepath)) {
    out.push({
      folder,
      format: "ebook",
      filepath: book.ebook.filepath,
      existingBook: book,
    })
  }
  if (
    book.readaloud?.filepath &&
    pathBelongsTo(folder, book.readaloud.filepath)
  ) {
    out.push({
      folder,
      format: "readaloud",
      filepath: book.readaloud.filepath,
      existingBook: book,
    })
  }
  if (
    book.audiobook?.filepath &&
    pathBelongsTo(folder, book.audiobook.filepath)
  ) {
    out.push({
      folder,
      format: "audiobook",
      filepath: book.audiobook.filepath,
      existingBook: book,
    })
  }
  return out
}

export type ListCandidatesOpts = {
  folder: string
  books: BookWithRelations[]
  collections?: UUIDList
  warnIfFileAtRoot?: boolean
  importRoot?: string
  importMode?: ImportMode
  epub2ImportStrategy?: Epub2ImportStrategy
}

type UUIDList = Candidate["collections"]

/**
 * For one book folder, produce the candidates the scanner should process:
 *   - 0/1 ebook + 0/1 readaloud + 0/1 audiobook from the filesystem
 *   - PLUS candidates for any existing book whose paths live under this folder
 *     (so vanished files get marked missing by checkExistsStep).
 *
 * Enforces "at most one regular epub and one readaloud epub per folder",
 * unless the multiEpubFolderStrategy setting is "separate-books": then each
 * epub in such a folder becomes its own book (unknown epubs only; known ones
 * keep their existing candidates) and audio in the folder is not imported.
 * On violation (strategy "skip"):
 *   - If no book already references this folder: warn and return only the
 *     existing-book candidates (which will be empty here, so effectively []).
 *   - If a book already exists here: warn, return only the existing-book
 *     candidates (don't ingest the offending duplicates, don't touch what's
 *     already there).
 */
export async function listBookCandidates(
  opts: ListCandidatesOpts,
  ctx: Pick<ScanCtx, "signal">,
): Promise<Candidate[]> {
  const folder = await canonicalizePath(opts.folder)
  if (ctx.signal.aborted) return []
  if (isInsideInternalDirectory(folder)) return []

  const knownBooks = booksReferencingFolder(folder, opts.books)
  const existingCandidates = knownBooks.flatMap((book) =>
    candidateFromExistingBook(folder, book),
  )

  const [epub2BackupSuffix, ignorePaths, multiEpubFolderStrategy] =
    await Promise.all([
      getSetting("epub2BackupSuffix"),
      getIgnorePaths(),
      getSetting("multiEpubFolderStrategy"),
    ])

  const classification = await classifyFolder(folder, {
    epub2BackupSuffix,
    ignorePaths,
  })
  if (!classification) return existingCandidates

  const { regularEpubs, readaloudEpubs, audiobookDir } = classification

  const violatesConstraint =
    regularEpubs.length > 1 || readaloudEpubs.length > 1
  // "separate-books": a folder with several epubs (for example one folder per
  // author) is not a violation, every epub is its own book
  const separateBooks =
    violatesConstraint && multiEpubFolderStrategy === "separate-books"
  if (violatesConstraint && !separateBooks) {
    if (knownBooks.length === 0) {
      logger.warn({
        msg: `Folder ${folder} has multiple epubs of the same kind; skipping until cleaned up`,
        regularEpubs,
        readaloudEpubs,
      })
      return []
    }
    logger.warn({
      msg: `Folder ${folder} has multiple epubs of the same kind; ignoring duplicates, keeping existing books intact`,
      regularEpubs,
      readaloudEpubs,
    })
    return existingCandidates
  }

  if (opts.warnIfFileAtRoot && opts.importRoot) {
    const root = await canonicalizePath(opts.importRoot)
    if (resolve(folder) === resolve(root)) {
      if (regularEpubs.length || readaloudEpubs.length || audiobookDir) {
        logger.warn({
          msg: `Files found directly at the watch root ${root}; please place books in subfolders. Skipping.`,
        })
      }
      return existingCandidates
    }
  }

  const candidates: Candidate[] = [...existingCandidates]
  const seen = new Set(existingCandidates.map(candidateKey))

  // If exactly one book already lives in this folder, treat it as the
  // owner for any new format candidates we discover here. Never in
  // separate-books mode: several books live in the folder.
  const folderOwner =
    !separateBooks && knownBooks.length === 1 ? knownBooks[0] : undefined

  function pushIfNew(candidate: Candidate) {
    if (seen.has(candidateKey(candidate))) return
    seen.add(candidateKey(candidate))
    candidates.push(candidate)
  }

  if (separateBooks) {
    const knownPaths = await knownEpubPaths(
      [...regularEpubs, ...readaloudEpubs],
      opts.books,
    )
    const epubs = [
      ...regularEpubs.map((filepath) => ({
        filepath,
        format: "ebook" as const,
      })),
      ...readaloudEpubs.map((filepath) => ({
        filepath,
        format: "readaloud" as const,
      })),
    ].sort((a, b) => a.filepath.localeCompare(b.filepath))

    for (const epub of epubs) {
      // already belongs to a book: its existing candidate (if any) covers it
      if (knownPaths.has(epub.filepath)) continue
      pushIfNew({
        folder,
        format: epub.format,
        filepath: epub.filepath,
        standalone: true,
        collections: opts.collections,
        ...(opts.importMode && { importMode: opts.importMode }),
        ...(opts.epub2ImportStrategy && {
          epub2ImportStrategy: opts.epub2ImportStrategy,
        }),
      })
    }

    if (audiobookDir) {
      logger.warn({
        msg: `Folder ${folder} has several epubs and audio files; not importing the audio because it cannot be known which ebook it belongs to. Put each audiobook in its own folder.`,
        epubCount: regularEpubs.length + readaloudEpubs.length,
      })
    }

    return candidates
  }

  const regularEpub = regularEpubs[0]
  if (regularEpub) {
    pushIfNew({
      folder,
      format: "ebook",
      filepath: regularEpub,
      collections: opts.collections,
      ...(opts.importMode && { importMode: opts.importMode }),
      ...(opts.epub2ImportStrategy && {
        epub2ImportStrategy: opts.epub2ImportStrategy,
      }),
      ...(folderOwner && !folderOwner.ebook && { existingBook: folderOwner }),
    })
  }

  const readaloudEpub = readaloudEpubs[0]
  if (readaloudEpub) {
    pushIfNew({
      folder,
      format: "readaloud",
      filepath: readaloudEpub,
      collections: opts.collections,
      ...(opts.importMode && { importMode: opts.importMode }),
      ...(opts.epub2ImportStrategy && {
        epub2ImportStrategy: opts.epub2ImportStrategy,
      }),
      ...(folderOwner &&
        !folderOwner.readaloud && { existingBook: folderOwner }),
    })
  }

  if (audiobookDir) {
    pushIfNew({
      folder,
      format: "audiobook",
      filepath: audiobookDir,
      collections: opts.collections,
      ...(opts.importMode && { importMode: opts.importMode }),
      ...(opts.epub2ImportStrategy && {
        epub2ImportStrategy: opts.epub2ImportStrategy,
      }),
      ...(folderOwner &&
        !folderOwner.audiobook && { existingBook: folderOwner }),
    })
  }

  return candidates
}

/**
 * Which of `epubPaths` are already the ebook/readaloud of an existing book.
 * Compares plain paths first, then canonical paths (bind mounts, symlinks)
 * for books whose file has the same name as one of the epubs.
 */
async function knownEpubPaths(
  epubPaths: string[],
  books: BookWithRelations[],
): Promise<Set<string>> {
  const known = new Set<string>()
  const byName = new Map<string, string[]>()
  for (const epubPath of epubPaths) {
    const list = byName.get(basename(epubPath)) ?? []
    list.push(epubPath)
    byName.set(basename(epubPath), list)
  }
  for (const book of books) {
    for (const stored of [book.ebook?.filepath, book.readaloud?.filepath]) {
      if (!stored) continue
      const sameName = byName.get(basename(stored))
      if (!sameName) continue
      let canonicalStored: string | undefined
      for (const epubPath of sameName) {
        if (epubPath === stored) {
          known.add(epubPath)
          continue
        }
        canonicalStored ??= await canonicalizePath(stored)
        if (canonicalStored === (await canonicalizePath(epubPath))) {
          known.add(epubPath)
        }
      }
    }
  }
  return known
}

function candidateKey(candidate: Candidate): string {
  return `${candidate.folder}::${candidate.format}::${candidate.filepath}`
}

export type WalkFoldersOpts = {
  root: string
  books: BookWithRelations[]
  warnIfFileAtRoot?: boolean
}

/**
 * Enumerate every folder under `root` that either:
 *   - contains at least one epub or audio file, or
 *   - is referenced by an existing book (so vanished files get visited).
 *
 * Returns canonicalized folder paths. Used by scanLibrary / kind:"roots".
 */
export async function walkFolders(
  opts: WalkFoldersOpts,
  ctx: Pick<ScanCtx, "signal">,
): Promise<string[]> {
  const root = await canonicalizePath(opts.root)
  if (ctx.signal.aborted) return []

  const folders = new Set<string>()

  let entries: Dirent[]
  try {
    entries = await readdir(root, { recursive: true, withFileTypes: true })
  } catch (error) {
    if (!isENOENT(error)) throw error
    entries = []
  }

  for (const entry of entries) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (ctx.signal.aborted) return []
    if (!entry.isFile() && !entry.isSymbolicLink()) continue
    if (isInsideInternalDirectory(entry.parentPath)) continue
    if (isHiddenFile(entry.name)) continue

    if (!isEpubFile(entry.name) && !isAudioFile(entry.name)) continue

    const parent = await canonicalizePath(entry.parentPath)
    folders.add(parent)
  }

  return [...folders]
}
