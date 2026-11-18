import { type HardcoverDoc } from "../match"

/** Minimal copies of the shapes Hardcover search returns. No network. */

export const twoTowers: HardcoverDoc = {
  id: 1,
  title: "The Two Towers",
  author_names: ["J.R.R. Tolkien"],
  series_names: ["The Lord of the Rings", "Middle Earth"],
  featured_series: {
    position: 2.0,
    series: { name: "The Lord of the Rings" },
  },
  genres: ["Fantasy", "Classics", "Science Fiction & Fantasy", "Epic"],
  moods: ["Adventurous", "tense", "1735854204224", "hopeful"],
  compilation: false,
  users_count: 7526,
  alternative_titles: ["The Two Towers", "Le due Torri"],
  book_category_id: 1,
}

export const twoTowersJunkEdition: HardcoverDoc = {
  id: 2,
  title: "The Two Towers by J. R. R. Tolkien",
  author_names: ["J.R.R. Tolkien"],
  series_names: ["Middle-earth Legendarium"],
  featured_series: {
    position: 3.0,
    series: { name: "Middle-earth Legendarium" },
  },
  genres: ["Science Fiction", "Young Adult"],
  users_count: 10,
  alternative_titles: ["The Two Towers by J. R. R. Tolkien"],
}

export const fellowship: HardcoverDoc = {
  id: 3,
  title: "The Fellowship of the Ring",
  author_names: ["J.R.R. Tolkien"],
  series_names: ["The Lord of the Rings", "Middle Earth"],
  featured_series: {
    position: 1.0,
    series: { name: "The Lord of the Rings" },
  },
  genres: ["Fantasy"],
  users_count: 11078,
  // A neighbour's title is listed as an alternative title.
  alternative_titles: ["The Two Towers"],
}

export const midnightSummary: HardcoverDoc = {
  id: 10,
  title: "Summary of The Midnight Library by Matt Haig",
  author_names: ["Moscow Press"],
  genres: ["Fiction"],
  users_count: 3,
}

export const midnightSuperSummary: HardcoverDoc = {
  id: 11,
  title: "The Midnight Library: Summary of the Book",
  author_names: ["SuperSummary"],
  users_count: 2,
}

export const calibanStudyGuide: HardcoverDoc = {
  id: 20,
  title: "Caliban's War: A Study Guide",
  author_names: ["SuperSummary"],
  series_names: ["The Expanse"],
  users_count: 400,
}

export const calibanReal: HardcoverDoc = {
  id: 21,
  title: "Caliban's War",
  author_names: ["James S.A. Corey"],
  series_names: ["The Expanse", "The Expanse (Chronological)"],
  featured_series: { position: 2.0, series: { name: "The Expanse" } },
  genres: ["Science Fiction", "Sci-fi", "Space Opera"],
  users_count: 20000,
}

export const eyeComic: HardcoverDoc = {
  id: 30,
  title: "Robert Jordan's Wheel of Time: Eye of the World #1",
  author_names: ["Robert Jordan", "Chuck Dixon"],
  series_names: ["Wheel of Time (Comics)"],
  genres: ["Comics", "Fantasy"],
  users_count: 900,
}

export const eyeReal: HardcoverDoc = {
  id: 31,
  title: "The Eye of the World",
  author_names: ["Robert Jordan"],
  series_names: ["The Wheel of Time", "Wheel of Time (Reading Order)"],
  featured_series: { position: 1.0, series: { name: "The Wheel of Time" } },
  genres: ["Fantasy", "Epic Fantasy", "Fiction"],
  users_count: 15000,
}

export const godEmperor: HardcoverDoc = {
  id: 40,
  title: "God Emperor of Dune",
  author_names: ["Frank Herbert"],
  series_names: ["Dune", "Dune Universe (Chronological)"],
  featured_series: { position: 4.0, series: { name: "Dune" } },
  genres: ["Science Fiction"],
  users_count: 9000,
}

export const boxSet: HardcoverDoc = {
  id: 50,
  title: "The Expanse Box Set Books 1-3",
  author_names: ["James S.A. Corey"],
  compilation: true,
  users_count: 5000,
}

export const neverwhereNovel: HardcoverDoc = {
  id: 60,
  title: "Neverwhere",
  author_names: ["Neil Gaiman"],
  series_names: [],
  genres: ["Fantasy"],
  users_count: 8000,
}

export const neverwhereDrama: HardcoverDoc = {
  id: 61,
  title: "Neverwhere (Full Cast Dramatisation)",
  author_names: ["Neil Gaiman"],
  genres: ["Fantasy"],
  users_count: 300,
}
