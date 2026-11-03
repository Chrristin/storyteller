import { useEffect } from "react"

import { useAppDispatch } from "@/store/appState"
import { useListServersQuery } from "@/store/localApi"
import { serverApi } from "@/store/serverApi"
import { type UUID } from "@/uuid"

import { type BookPrefs, getAllBookPrefs, setBookPrefs } from "./bookPrefs"

/**
 * Keeps rating, notes and favourite in step with the server. They are stored
 * there, per user, using what the server already has: the per-user rating and
 * review for ratings and notes, and a shelf named "Favourites" for favourites
 * (so they also show up as a shelf in the web app). The phone keeps a copy so
 * the book page works offline.
 *
 * A change is saved on the phone first and sent right away. If the server
 * cannot be reached it stays marked as waiting and is sent on the next sync.
 */
export const FAVOURITES_SHELF = "Favourites"

type Dispatch = ReturnType<typeof useAppDispatch>
type BookRef = { uuid: UUID; serverUuid: UUID | null }

async function findFavouritesShelf(dispatch: Dispatch, serverUuid: UUID) {
  const shelves = await dispatch(
    serverApi.endpoints.listShelves.initiate(
      { serverUuid },
      { forceRefetch: true, subscribe: false },
    ),
  ).unwrap()
  return shelves.find(
    (shelf) => shelf.name === FAVOURITES_SHELF && !shelf.filter,
  )
}

/**
 * The server keeps one row per user and book with a rating and a review, and
 * deletes the row when both are empty. "No rating" with a note is a rating
 * of 0, which the phone reads back as no rating.
 */
async function pushRating(
  dispatch: Dispatch,
  serverUuid: UUID,
  bookUuid: UUID,
  rating: number,
  hasReview: boolean,
) {
  if (rating > 0 || hasReview) {
    await dispatch(
      serverApi.endpoints.setBookRating.initiate({
        serverUuid,
        bookUuid,
        body: { rating },
      }),
    ).unwrap()
  } else {
    await dispatch(
      serverApi.endpoints.deleteBookRating.initiate({ serverUuid, bookUuid }),
    ).unwrap()
  }
}

async function pushReview(
  dispatch: Dispatch,
  serverUuid: UUID,
  bookUuid: UUID,
  review: string,
  rating: number,
) {
  if (review) {
    await dispatch(
      serverApi.endpoints.setBookRating.initiate({
        serverUuid,
        bookUuid,
        body: { review },
      }),
    ).unwrap()
  } else if (rating > 0) {
    await dispatch(
      serverApi.endpoints.setBookRating.initiate({
        serverUuid,
        bookUuid,
        body: { rating, review: null },
      }),
    ).unwrap()
  } else {
    await dispatch(
      serverApi.endpoints.deleteBookRating.initiate({ serverUuid, bookUuid }),
    ).unwrap()
  }
}

async function pushFavourite(
  dispatch: Dispatch,
  serverUuid: UUID,
  bookUuid: UUID,
  favourite: boolean,
) {
  const shelf = await findFavouritesShelf(dispatch, serverUuid)
  if (!shelf) {
    if (!favourite) return
    await dispatch(
      serverApi.endpoints.createShelf.initiate({
        serverUuid,
        name: FAVOURITES_SHELF,
        books: [bookUuid],
      }),
    ).unwrap()
    return
  }
  const others = shelf.books
    .map((b) => b.bookUuid)
    .filter((uuid) => uuid !== bookUuid)
  await dispatch(
    serverApi.endpoints.setShelfBooks.initiate({
      serverUuid,
      shelfUuid: shelf.uuid,
      books: favourite ? [...others, bookUuid] : others,
    }),
  ).unwrap()
}

type Field = "rating" | "review" | "favourite"

function markDirty(uuid: string, field: Field, value: boolean) {
  setBookPrefs(uuid, {
    dirty: { ...getAllBookPrefs()[uuid]?.dirty, [field]: value },
  })
}

async function push(
  dispatch: Dispatch,
  serverUuid: UUID,
  bookUuid: UUID,
  field: Field,
  prefs: BookPrefs,
) {
  const rating = prefs.rating ?? 0
  const review = prefs.review ?? ""
  if (field === "rating") {
    await pushRating(dispatch, serverUuid, bookUuid, rating, !!review)
  } else if (field === "review") {
    await pushReview(dispatch, serverUuid, bookUuid, review, rating)
  } else {
    await pushFavourite(dispatch, serverUuid, bookUuid, !!prefs.favourite)
  }
}

/** Rating, notes and favourite changes for a book. */
export function useBookPrefActions() {
  const dispatch = useAppDispatch()

  async function change(book: BookRef, field: Field, patch: BookPrefs) {
    const serverUuid = book.serverUuid
    setBookPrefs(book.uuid, patch)
    if (!serverUuid) return
    setBookPrefs(book.uuid, { server: serverUuid })
    markDirty(book.uuid, field, true)
    try {
      await push(
        dispatch,
        serverUuid,
        book.uuid,
        field,
        getAllBookPrefs()[book.uuid] ?? {},
      )
      markDirty(book.uuid, field, false)
    } catch {
      // Stays marked as waiting; the next sync sends it.
    }
  }

  return {
    setRating: (book: BookRef, rating: number) =>
      change(book, "rating", { rating }),
    setReview: (book: BookRef, review: string) =>
      change(book, "review", { review: review.trim() }),
    setFavourite: (book: BookRef, favourite: boolean) =>
      change(book, "favourite", { favourite }),
  }
}

async function syncServer(dispatch: Dispatch, serverUuid: UUID) {
  // 1. Send what is waiting.
  for (const [uuid, prefs] of Object.entries(getAllBookPrefs())) {
    if (prefs.server !== serverUuid || !prefs.dirty) continue
    for (const field of ["rating", "review", "favourite"] as const) {
      if (!prefs.dirty[field]) continue
      try {
        await push(
          dispatch,
          serverUuid,
          uuid as UUID,
          field,
          getAllBookPrefs()[uuid] ?? prefs,
        )
        markDirty(uuid, field, false)
      } catch {
        // Server unreachable: leave it for next time.
      }
    }
  }

  // 2. Take the server's values for everything that is not waiting.
  const rows = await dispatch(
    serverApi.endpoints.listUserRatings.initiate(
      { serverUuid },
      { forceRefetch: true, subscribe: false },
    ),
  ).unwrap()
  const shelf = await findFavouritesShelf(dispatch, serverUuid)

  const byBook = new Map(rows.map((r) => [r.bookUuid, r]))
  const favourites = new Set(shelf?.books.map((b) => b.bookUuid) ?? [])
  const known = new Set<string>([
    ...byBook.keys(),
    ...favourites,
    ...Object.entries(getAllBookPrefs())
      .filter(([, p]) => p.server === serverUuid)
      .map(([uuid]) => uuid),
  ])

  for (const uuid of known) {
    const current = getAllBookPrefs()[uuid]
    const row = byBook.get(uuid as UUID)
    const patch: BookPrefs = {}
    if (!current?.dirty?.rating) {
      const rating = row?.rating ?? 0
      if ((current?.rating ?? 0) !== rating) patch.rating = rating
    }
    if (!current?.dirty?.review) {
      const review = row?.review ?? ""
      if ((current?.review ?? "") !== review) patch.review = review
    }
    if (!current?.dirty?.favourite) {
      const favourite = favourites.has(uuid as UUID)
      if (!!current?.favourite !== favourite) patch.favourite = favourite
    }
    // Remember which server this book belongs to, so a later removal on the
    // server is picked up too. Books that are only on this phone are left alone.
    if (current?.server !== serverUuid) patch.server = serverUuid
    if (Object.keys(patch).length) setBookPrefs(uuid, patch)
  }
}

/** Runs one sync per server when the app opens its library. */
export function useBookPrefsSync() {
  const dispatch = useAppDispatch()
  const { data: servers } = useListServersQuery()

  useEffect(() => {
    if (!servers) return
    for (const server of servers) {
      if (!server.username) continue
      syncServer(dispatch, server.uuid).catch(() => {
        // Offline or not logged in: try again next time.
      })
    }
  }, [dispatch, servers])
}
