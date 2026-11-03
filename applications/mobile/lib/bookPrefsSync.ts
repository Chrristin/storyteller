import { useEffect } from "react"

import { useAppDispatch } from "@/store/appState"
import { useListServersQuery } from "@/store/localApi"
import { serverApi } from "@/store/serverApi"
import { type UUID } from "@/uuid"

import { getAllBookPrefs, setBookPrefs } from "./bookPrefs"

/**
 * Keeps rating and favourite in step with the server, using what it already
 * has: the per-user rating API for ratings, and a shelf named "Favourites"
 * for favourites (so they also show up as a shelf in the web app).
 *
 * A change is saved on the phone first and sent right away. If the server
 * cannot be reached it stays marked as waiting and is sent on the next sync.
 */
export const FAVOURITES_SHELF = "Favourites"

type Dispatch = ReturnType<typeof useAppDispatch>

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

async function pushRating(
  dispatch: Dispatch,
  serverUuid: UUID,
  bookUuid: UUID,
  rating: number,
) {
  if (rating > 0) {
    await dispatch(
      serverApi.endpoints.setBookRating.initiate({
        serverUuid,
        bookUuid,
        rating,
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

/** Rating and favourite changes for books that live on a server. */
export function useBookPrefActions() {
  const dispatch = useAppDispatch()

  return {
    async setRating(
      book: { uuid: UUID; serverUuid: UUID | null },
      rating: number,
    ) {
      const serverUuid = book.serverUuid
      setBookPrefs(book.uuid, {
        rating,
        ...(serverUuid && {
          server: serverUuid,
          dirty: { ...getAllBookPrefs()[book.uuid]?.dirty, rating: true },
        }),
      })
      if (!serverUuid) return
      try {
        await pushRating(dispatch, serverUuid, book.uuid, rating)
        setBookPrefs(book.uuid, {
          dirty: { ...getAllBookPrefs()[book.uuid]?.dirty, rating: false },
        })
      } catch {
        // Stays marked as waiting; the next sync sends it.
      }
    },
    async setFavourite(
      book: { uuid: UUID; serverUuid: UUID | null },
      favourite: boolean,
    ) {
      const serverUuid = book.serverUuid
      setBookPrefs(book.uuid, {
        favourite,
        ...(serverUuid && {
          server: serverUuid,
          dirty: { ...getAllBookPrefs()[book.uuid]?.dirty, favourite: true },
        }),
      })
      if (!serverUuid) return
      try {
        await pushFavourite(dispatch, serverUuid, book.uuid, favourite)
        setBookPrefs(book.uuid, {
          dirty: { ...getAllBookPrefs()[book.uuid]?.dirty, favourite: false },
        })
      } catch {
        // Stays marked as waiting; the next sync sends it.
      }
    },
  }
}

async function syncServer(dispatch: Dispatch, serverUuid: UUID) {
  // 1. Send what is waiting.
  for (const [uuid, prefs] of Object.entries(getAllBookPrefs())) {
    if (prefs.server !== serverUuid || !prefs.dirty) continue
    const bookUuid = uuid as UUID
    try {
      if (prefs.dirty.rating) {
        await pushRating(dispatch, serverUuid, bookUuid, prefs.rating ?? 0)
        setBookPrefs(uuid, {
          dirty: { ...getAllBookPrefs()[uuid]?.dirty, rating: false },
        })
      }
      if (prefs.dirty.favourite) {
        await pushFavourite(dispatch, serverUuid, bookUuid, !!prefs.favourite)
        setBookPrefs(uuid, {
          dirty: { ...getAllBookPrefs()[uuid]?.dirty, favourite: false },
        })
      }
    } catch {
      // Server unreachable: leave it for next time.
    }
  }

  // 2. Take the server's values for everything that is not waiting.
  const ratings = await dispatch(
    serverApi.endpoints.listUserRatings.initiate(
      { serverUuid },
      { forceRefetch: true, subscribe: false },
    ),
  ).unwrap()
  const shelf = await findFavouritesShelf(dispatch, serverUuid)

  const ratingByBook = new Map(ratings.map((r) => [r.bookUuid, r.rating ?? 0]))
  const favourites = new Set(shelf?.books.map((b) => b.bookUuid) ?? [])
  const known = new Set<string>([
    ...ratingByBook.keys(),
    ...favourites,
    ...Object.entries(getAllBookPrefs())
      .filter(([, p]) => p.server === serverUuid)
      .map(([uuid]) => uuid),
  ])

  for (const uuid of known) {
    const current = getAllBookPrefs()[uuid]
    const patch: { rating?: number; favourite?: boolean; server?: string } = {}
    if (!current?.dirty?.rating) {
      const rating = ratingByBook.get(uuid as UUID) ?? 0
      if ((current?.rating ?? 0) !== rating) patch.rating = rating
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
