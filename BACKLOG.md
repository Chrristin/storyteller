# Backlog

Things we decided to do later, or that are not finished. Newest at the top of each
section. Move an item to "Done" when it ships.

## Next up

- **Hover on the web: darken the cover and show the title.** When the pointer is
  over a book card, darken the cover and show the title (and author) over it.
  Applies to ebook cards, which have no text under them now, and can also help
  audiobook cards whose text is cut off with an ellipsis. Keep the title readable
  on pale covers. On the phone, the equivalent is a long press (not decided).

## Decide or finish

- **Level 2 missing books.** Ask Hardcover for each series' full book list, so the
  Series screen and series pages can say "book 6 of 9 is not in your library" and show the
  books after your last one. Needs a free Hardcover account token in Settings,
  Metadata. Not built. Level 1 (gaps between books you own) is done.
- **Turn the nightly library tidy on.** It only previews today. Read the plan
  (GET /api/v2/library/tidy, or the container log), and when it looks right set
  `STORYTELLER_AUTO_TIDY=apply` in the stack.
- **Email on the server.** Set up Mailgun SMTP in Settings, Email. Send to Kindle
  and invites need it. Domain records on Cloudflare for `mg.christingeorge.com`
  are not done yet.
- **Notes in the app.** The plus button, the note count icon and a notes screen
  are not built. The server and web already have notes.
- **Book page action row.** The condensed row with round Drive and Kindle icon
  buttons (as in the mockup) is not built; the Drive and Kindle cards stay.
- **Genre tagging for books no online source knows.** Could use an AI, which costs
  money and sends titles to an outside service. Not decided.

## Known issues

- **Another user's progress on the phone.** The phone's local tables have no user
  column. If a server is removed and added again under a different user,
  downloaded books keep the old positions and they are uploaded to the new
  account. Not fixed.
- **Possible upstream bug, not confirmed.** `deleteBooksFromServer` in
  `applications/mobile/database/books.ts` may delete books from other servers when
  more than one server is on the phone.
- **Web cards with titles under covers off** also hide the other card fields
  (rating, series position). Decide whether to keep some of them.
- **"Select all"** in the app selects every book with an ebook, including books
  where the user has no Drive or Kindle action. The bar flags the ones left out.
- **Dutch translations.** `messages/nl.json` has none of the new strings (Drive,
  Series, Titles under covers).
- **Two migrations are both numbered 128.** It works, because migrations are
  tracked by content, but it is untidy.
- **Nothing has been seen running** for the newest screens (waves, text on waves,
  piles, tall web cards). Check them on a phone and in a browser, then fix what
  looks off.

## Done

- Per user Google Drive sync to a Kobo, and Send to Kindle in the app.
- Library layout: currently reading strip, tilted covers, wave fill, three columns,
  Recently added.
- Series with "N missing" (gaps) on the phone and web, replacing the old Piles and Missing books pages, and the library tidy preview.
- Tall 2 by 3 web cards, titles on the waves, "Titles under covers" switch.

- Web: scrollbars are hidden everywhere (globals.css base layer). Revert there if some list needs one.
