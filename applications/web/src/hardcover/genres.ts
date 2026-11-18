/**
 * Hardcover's genre and mood lists are noisy ("Sci-fi", "Science Fiction" and
 * "science fiction fantasy" all appear). We map them onto a short canonical
 * list and keep at most three per book.
 *
 * Choices:
 * - Genres that are not in the table are dropped, so nothing noisy reaches the
 *   library. Add a line to GENRE_MAP to allow another one.
 * - "Epic Fantasy", "High Fantasy" and "Epic" all become "Fantasy".
 * - Not genres (Fiction, Comics, Juvenile Fiction, Children, Audiobooks) are
 *   listed in DROPPED_GENRES. They are also simply absent from GENRE_MAP.
 */

export const MAX_GENRES = 3
export const MAX_MOODS = 3

const SCIENCE_FICTION = "Science Fiction"
const FANTASY = "Fantasy"

/** Lowercase Hardcover genre -> display name. */
export const GENRE_MAP: Record<string, string> = {
  "sci-fi": SCIENCE_FICTION,
  scifi: SCIENCE_FICTION,
  sf: SCIENCE_FICTION,
  "science fiction": SCIENCE_FICTION,
  "science-fiction": SCIENCE_FICTION,
  "science fiction fantasy": SCIENCE_FICTION,
  "science fiction & fantasy": SCIENCE_FICTION,
  "science fiction and fantasy": SCIENCE_FICTION,
  "sci-fi fantasy": SCIENCE_FICTION,
  "sci-fi & fantasy": SCIENCE_FICTION,
  "space opera": "Space Opera",
  cyberpunk: "Cyberpunk",
  steampunk: "Steampunk",
  dystopian: "Dystopian",
  dystopia: "Dystopian",
  "post-apocalyptic": "Post-Apocalyptic",
  "post apocalyptic": "Post-Apocalyptic",

  fantasy: FANTASY,
  "epic fantasy": FANTASY,
  "high fantasy": FANTASY,
  epic: FANTASY,
  "sword and sorcery": FANTASY,
  "sword & sorcery": FANTASY,
  "dark fantasy": FANTASY,
  "urban fantasy": "Urban Fantasy",
  "progression fantasy": "Progression Fantasy",
  litrpg: "LitRPG",
  "litrpg (literary role-playing game)": "LitRPG",
  "lit rpg": "LitRPG",
  gamelit: "LitRPG",
  paranormal: "Paranormal",

  "young adult": "Young Adult",
  "young adult fiction": "Young Adult",
  ya: "Young Adult",

  mystery: "Mystery",
  "mystery & detective": "Mystery",
  "mystery, thriller & suspense": "Mystery",
  detective: "Mystery",
  crime: "Crime",
  thriller: "Thriller",
  thrillers: "Thriller",
  "thriller & suspense": "Thriller",
  suspense: "Suspense",
  horror: "Horror",

  adventure: "Adventure",
  "action & adventure": "Adventure",
  "action and adventure": "Adventure",
  action: "Adventure",

  romance: "Romance",
  "romantic fiction": "Romance",
  "contemporary romance": "Romance",
  "historical fiction": "Historical Fiction",
  historical: "Historical Fiction",
  "literary fiction": "Literary Fiction",
  literary: "Literary Fiction",
  contemporary: "Contemporary",
  classics: "Classics",
  humor: "Humor",
  humour: "Humor",
  comedy: "Humor",
  western: "Western",
  war: "War",
  poetry: "Poetry",
  mythology: "Mythology",

  nonfiction: "Nonfiction",
  "non-fiction": "Nonfiction",
  "non fiction": "Nonfiction",
  biography: "Biography",
  memoir: "Biography",
  autobiography: "Biography",
  "biography & autobiography": "Biography",
  history: "History",
  science: "Science",
  philosophy: "Philosophy",
  "self-help": "Self-Help",
  "self help": "Self-Help",
  business: "Business",
  psychology: "Psychology",
}

/** Genres that are not genres. Documented here; they are not in GENRE_MAP. */
export const DROPPED_GENRES = [
  "comics",
  "comic books",
  "graphic novels",
  "comics & graphic novels",
  "fiction",
  "juvenile fiction",
  "children",
  "children's",
  "children's stories",
  "childrens",
  "audiobooks",
  "audiobook",
  "general",
  "literature & fiction",
  "novels",
]

function genreKey(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Maps Hardcover genres onto the short list, in Hardcover's order, without
 * duplicates, at most `max` of them.
 */
export function normaliseGenres(
  genres: readonly unknown[] | null | undefined,
  max = MAX_GENRES,
): string[] {
  const out: string[] = []
  for (const raw of genres ?? []) {
    if (typeof raw !== "string") continue
    const mapped = GENRE_MAP[genreKey(raw)]
    if (!mapped || out.includes(mapped)) continue
    out.push(mapped)
    if (out.length >= max) break
  }
  return out
}

/** Lowercase moods, no numbers or junk, no duplicates, at most `max`. */
export function normaliseMoods(
  moods: readonly unknown[] | null | undefined,
  max = MAX_MOODS,
): string[] {
  const out: string[] = []
  for (const raw of moods ?? []) {
    if (typeof raw !== "string") continue
    const mood = raw.normalize("NFKC").trim().toLowerCase()
    if (mood.length < 3 || mood.length > 24) continue
    if (!/^\p{L}[\p{L} -]*$/u.test(mood)) continue
    if (out.includes(mood)) continue
    out.push(mood)
    if (out.length >= max) break
  }
  return out
}
