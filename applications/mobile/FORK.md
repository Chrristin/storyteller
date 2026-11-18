# Fork notes: design system and EAS build

## How theming works

- **Tokens** live in `global.css`. Tailwind v4 `@theme` declares the defaults
  (light); `@layer theme` re-declares them under Uniwind's `@variant light` and
  `@variant dark`. The app follows the system setting (`userInterfaceStyle:
  "automatic"` in `app.config.ts`).
- **Class names** use the shadcn-style semantic tokens: `bg-background`,
  `bg-card`, `bg-secondary`, `bg-muted`, `text-foreground`,
  `text-muted-foreground`, `bg-primary` / `text-primary-foreground`,
  `border-border`, `text-destructive`. Change a colour once in `global.css` and
  every screen follows.
- **Components** in `components/ui` (button, text, input, select, dialogs,
  menus) wrap React Native primitives with `class-variance-authority` variants.
  `Text` has the type variants (`h1`–`h4`, `muted`, `small`, ...).
- **Reader colours are separate.** Reading themes, highlight colours and
  custom themes are handled by `useColorTheme`, `colors.ts` and
  `components/ui/tokens/colors.ts`. They are reader content, not app chrome,
  and were left alone.
- `design.ts` and `colors.ts` only hold a few constants (`appColor`,
  highlight tints).

## Screens (`app/(root)`)

| Screen | File |
| --- | --- |
| Library / shelves (home) | `index.tsx`, `components/Shelf.tsx` |
| Full shelf, collection, series, author, narrator, tag | `shelf/[type]`, `collection/[uuid]`, ... all use `components/BookGrid.tsx` |
| Search | `search.tsx` |
| Book detail | `book/[uuid].tsx` |
| Reader | `read/[uuid].tsx`, `components/Epub.tsx`, `Toolbar.tsx`, `SelectionMenu.tsx` |
| Player | `listen/[uuid].tsx`, `components/MiniPlayerWidget.tsx`, `PlayPause.tsx`, `ProgressBar.tsx` |
| Reader sheets | `reading-settings`, `navigation-menu/*`, `speed-menu`, `footnote`, `custom-theme/*`, `custom-fonts` |
| Settings | `settings.tsx`, `components/ReadingSettings.tsx` |
| Login / server | `server.tsx` (add server), `components/LoginButton.tsx` (browser login through the server) |

There is no in-app username/password form. Login opens the server's
`/api/v2/token/app` page in a browser and returns to the app through the
`storyteller://settings` deep link, so that scheme must not change.

## The flat design system

- Neutral zinc palette plus one accent (indigo `#4f46e5` light, `#8b8ff8`
  dark). To change the accent, edit `--color-primary`, `--color-link`,
  `--color-accent` and `--color-accent-foreground` in both modes.
- No shadows (`--shadow-*` are zeroed; shadow classes removed from components).
  Separation comes from 1px borders and tonal surfaces (`card`, `secondary`).
- Radii: 6 / 10 / 14 / 20 px (`rounded-sm/md/lg/xl`). Buttons and inputs use
  `lg`, cards `xl`, icon buttons are round.
- Type: system sans for everything in the app chrome (the serif headings are
  gone). Headings are `h1` 30 bold, `h2` 20, `h3` 18, `h4` 16, body 16, meta 14 / 12.
- Not changed: the reader's own fonts and themes.

## Library layout and tilt

- **Covers only.** Grids and shelves show covers without text. A cover is
  always in the same tall 2:3 slot, so rows line up. Ebooks have no mark. An
  audiobook keeps its square cover whole at the top of the slot, and the
  bottom third is filled with four smooth layered waves in the cover's main
  colour (light to dark, on a darker card background). The waves are random
  per book but stable, seeded from the book uuid (`lib/waves.ts`). The main
  colour is the first of the server's cover `colors`, or the average colour of
  its blurhash, saved in the `audioCoverColor` and `textCoverColor` columns
  (migration `1793100000000_add_book_cover_colors`); a book without one gets a
  muted colour derived from its uuid. A small dark
  pill in the top-left corner shows headphones for an audiobook, or headphones
  and a book for a read-aloud. A 3px accent line along the bottom edge shows
  progress. With waves on and Titles under covers off, an audiobook cover also
  writes its author and title in white inside the waves on a soft dark fade
  (not in the currently reading strip or the book page hero); with Titles under
  covers on the text goes back under the cover and the waves stay plain
  (`lib/coverTitleOverlay.ts`). Code: `components/BookCover.tsx`, `components/FormatBadge.tsx`.
- **Tilt.** Each cover leans a little, worked out from the book id so a book
  always leans the same way (`lib/tilt.ts`, a pure function with a test). Only
  the cover tilts, never text, buttons, progress rings or the selection check.
  A book that is selected for Drive or Kindle straightens. The big cover on the
  book page leans a fixed amount to the left.
- **Currently reading strip.** `components/CurrentlyReading.tsx` replaces the
  big continue card and the "Also in progress" shelf on the home screen. The
  book read last is a compact card; other books in progress are round covers
  with a progress ring. Tap one to expand the card, tap the up arrow to go
  back. It uses only data the app already has (title, author, percent, format,
  chapter title and last read time when the position has them).
- **Settings, "Library look".** Four controls, saved on the phone (AsyncStorage,
  `lib/libraryLook.ts`, defaults in `lib/libraryLookDefaults.ts`) and applied
  at once through `useLibraryLook()`:
  - Cover tilt: Off, Subtle (1.6 degrees, 1.5px), Medium (3, 2.5px) or
    Strong (5, 4px). Default Subtle.
  - Titles under covers: off by default.
  - Wave fill behind audiobook covers: on by default. Off gives a plain card
    background below the square. An old saved `blurFill` value still counts.
  - Currently reading strip: on by default.
- The only database change is the two nullable cover colour columns above, filled during sync.

## Cloud Android build

The fork reads its Expo account from environment variables, so nothing in the
repo points at the upstream account.

```bash
cd applications/mobile
npx eas-cli login
npx eas-cli init            # creates the project; prints the project id
```

Then give the build your values as EAS environment variables (they are not in
`eas.json`, so nothing needs editing in the repo):

```bash
npx eas-cli env:create --name EXPO_OWNER --value <your-expo-username> --environment development --visibility plaintext
npx eas-cli env:create --name EAS_PROJECT_ID --value <project-id-from-eas-init> --environment development --visibility plaintext
```

Build the development client (installs as `com.christingeorge.storyteller.dev`):

```bash
npx eas-cli build --platform android --profile development
```

Override the package id with `ANDROID_PACKAGE` if you want a different one.
Sentry is only used by the `*-sentry` profiles and needs `SENTRY_AUTH_TOKEN`;
the development profile does not need it.

## Server: automatic ebook and audiobook linking

`applications/web/src/bookLinker.ts` finds an ebook and an audiobook that were
imported as two separate books and merges them into one book with both
formats. It runs every night at 03:30 server time.

- It links only on a shared ISBN/ASIN, or on a near-identical title plus a
  matching author, and only when the pair is each other's clear best match.
  Numbers in titles and series positions must agree. Anything unclear is left
  alone.
- Reading status, rating, shelf entries and progress of the merged-away book
  are kept.
- `STORYTELLER_AUTO_LINK=false` turns it off. `STORYTELLER_AUTO_LINK_CRON`
  changes the schedule.
- To run it now: `POST /api/v2/books/auto-link?dryRun=true` shows what it
  would link; without `dryRun` it links. Needs a login with book-create
  permission.

## Rating and favourites sync

No server change was needed.

- **Rating** uses the server's per-user rating API (`PUT/DELETE /books/{id}/rating`, `GET /user/ratings`). It is the same rating the web app shows.
- **Favourites** are the books on a shelf named "Favourites" that the app creates on first use (`/shelves`). It also appears as a shelf in the web app. If you already have a shelf called "Favourites" with no filter, the app uses it.
- A change is saved on the phone first and sent straight away. If the server cannot be reached it is marked as waiting and sent the next time the home screen opens. Otherwise the server's values win.
- Books that exist only on the phone (imported files) keep their rating and favourite locally.

## Sync to Google Drive (for a Kobo)

The server copies the plain ebook of selected books into a `Storyteller` folder
inside the `Rakuten Kobo` folder in the user's own Google Drive, which the Kobo's
own Drive sync reads. It is per user: the server owner saves one Google client in
the web settings (Settings, Server, Google Drive), and each user connects their
own Google account in their web Preferences (Devices tab). The app only asks the
server to do it.

- **What shows is per user.** The app asks the server (`GET /delivery`) what the
  signed-in user can do. Drive buttons appear only for users who connected Google;
  "Send to Kindle" appears only for users who saved a Kindle address when the
  server can send email. A user with neither sees neither.
- **Book page:** a "Google Drive" card and a "Send to Kindle" card, each shown
  only when it applies and the book has an ebook.
- **Library:** long press a book to start selecting, then "Sync N to Drive" and/or
  "Send N to Kindle". When either applies, long press on those tiles starts
  selection instead of the Open book / Play audiobook menu.
- Drive: books already in the folder are skipped unless "Replace files already in
  Drive" is ticked. Only the ebook is sent, never an audiobook or read-aloud
  version. Kindle: groups of up to 25 books, one email per group, and the server
  refuses a group over about 25 MB.

## Signing the Android app

The APK is built on GitHub (`.github/workflows/android-apk.yml`) and signed with
your own key, then published as a Release named `storyteller-<run number>`.

- The key (a keystore with the alias `storyteller`) is made and kept by you, on
  your NAS. It is never committed.
- Two repository secrets give the build the key: `STORYTELLER_KEYSTORE_B64`
  (the keystore file, base64 encoded) and `STORYTELLER_KEYSTORE_PASS` (the
  password, used for both the keystore and the key).
- Android only installs an update over an app signed with the same key. If the
  keystore or its password is lost, the app has to be uninstalled and its
  downloaded books are lost. Keep a copy somewhere other than the NAS.
- Without the two secrets the workflow still builds, signed with Expo's public
  debug key, and attaches the APK to the run instead of publishing a Release.

## Reading themes

Besides Day, Sepia, Crisp White and Night, the app adds six reading themes for
long reading, for new installs and, through a migration, existing ones: Dark Grey,
Soft Grey, Warm Dark, OLED Black, Paper and Soft Sepia. A theme with the same
name that you already have is left as it is. Pure white on pure black is the
maximum contrast (21:1); these sit at about 10:1 to 13:1, which most people find
easier on the eyes for long reading.

## Piles and missing books

The Library menu (the three dots) has a "Piles" item. It opens a screen that
shows your series, or your authors, as piles of three covers with the name and
the number of books. Tap a pile to open that series or author. Series piles
show the first three books by series position; author piles show the newest
three. If the same series name comes from two servers it is one pile.

Missing books are found on the phone from the series positions the app already
stores, so it works offline and the server is not involved. Only whole numbers
from 1 up count, and a series needs two different owned positions. The gaps are
the numbers between the lowest and highest owned book, so a series is never
guessed past its last owned book. When there are gaps, the Piles header shows
"Missing books (N)", and the series page shows a dashed amber "#3 Missing"
tile in the right place. The logic is in `lib/seriesGaps.ts`, `lib/piles.ts` and
`lib/seriesLayout.ts` (all pure, with tests). The amber colour is the
`missing` token in `global.css`.

## After updating the app

The wave fill and the new Library layout use each cover's main colour. Books that
were already on the phone get their colour the next time the library syncs, so
open the Library and pull down to refresh once. Until then those covers use a
steady muted colour.

The web library has the same "Titles under covers" switch in Preferences, Books.
Audiobook cards show the title and author on the waves; every other card has no
text under it unless that switch is on.

## Home sections

Home shows three 3 column grids under the currently reading strip: To Read
(first 6, button "Read More"), Recently Added (first 9, button "All") and
Recently Completed (first 6, button "More"). A section with no books renders
nothing and its button is hidden when everything already fits. The buttons open
`shelf/[type]` with type `to-read`, `start-reading` or `completed`. Rules and
limits live in `lib/homeSections.ts` (tests in `lib/homeSections.test.ts`).
Recently Completed is ordered by the last reading position timestamp, because
the local data has no time for when a status was set.

To Read is manual. Books with no status on the server now keep no local status
(the sync used to turn them into "To read"). The book page and the selection
bar add "Add to To Read" / "Remove from To Read"; adding sets the local status
(pushed by the status sync), removing sends status null to the server and then
deletes the local status, so it needs a connection. Selecting is now allowed
for any book on a server; Drive and Kindle still only take books with an ebook.
