import { describe, expect, it } from "vitest"

import { normaliseGenres, normaliseMoods } from "../genres"

describe("normaliseGenres", () => {
  it("maps the noisy science fiction names to one", () => {
    expect(normaliseGenres(["Sci-fi"])).toEqual(["Science Fiction"])
    expect(
      normaliseGenres(["science fiction fantasy", "Science Fiction", "Sci-fi"]),
    ).toEqual(["Science Fiction"])
  })

  it("maps LitRPG, Fantasy, Young Adult and Adventure", () => {
    expect(
      normaliseGenres(["litrpg", "LitRPG (Literary Role-Playing Game)"]),
    ).toEqual(["LitRPG"])
    expect(normaliseGenres(["Epic Fantasy", "Epic", "fantasy"])).toEqual([
      "Fantasy",
    ])
    expect(normaliseGenres(["YA", "Young Adult"])).toEqual(["Young Adult"])
    expect(normaliseGenres(["Action & Adventure"])).toEqual(["Adventure"])
  })

  it("keeps mystery and thriller distinct", () => {
    expect(
      normaliseGenres(["Mystery", "Thriller & Suspense", "Suspense"]),
    ).toEqual(["Mystery", "Thriller", "Suspense"])
  })

  it("drops non genres and unknown names", () => {
    expect(
      normaliseGenres([
        "Comics",
        "Fiction",
        "Juvenile Fiction",
        "Children",
        "Children's stories",
        "Audiobooks",
        "Middle Earth (Imaginary place)",
        "Horror",
      ]),
    ).toEqual(["Horror"])
  })

  it("keeps at most three, in Hardcover's order", () => {
    expect(
      normaliseGenres(["Fantasy", "Classics", "Adventure", "Romance", "War"]),
    ).toEqual(["Fantasy", "Classics", "Adventure"])
    expect(normaliseGenres(undefined)).toEqual([])
  })
})

describe("normaliseMoods", () => {
  it("lowercases, drops numbers and junk, keeps three", () => {
    expect(
      normaliseMoods([
        "1735854204224",
        "Adventurous",
        "tense",
        "x",
        "Hopeful",
        "dark",
      ]),
    ).toEqual(["adventurous", "tense", "hopeful"])
    expect(normaliseMoods(["tense", "Tense"])).toEqual(["tense"])
  })
})
