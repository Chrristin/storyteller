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
