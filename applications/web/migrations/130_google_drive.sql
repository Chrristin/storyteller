-- Optional sync of ebooks to a Google Drive folder, so a Kobo (or anything else
-- that reads a Drive folder) can pick them up.
--
-- google_drive_config holds at most one row: the owner's own Google OAuth
-- client, the sign-in token Google gave back, and the folder books go into.
-- client_secret and refresh_token are stored encrypted (see src/secrets.ts).
CREATE TABLE IF NOT EXISTS google_drive_config (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  client_id TEXT,
  client_secret TEXT,
  refresh_token TEXT,
  account_email TEXT,
  folder_id TEXT,
  oauth_state TEXT,
  oauth_redirect_uri TEXT,
  oauth_state_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Which books have been copied to Drive, and under which file.
CREATE TABLE IF NOT EXISTS book_drive_file (
  book_uuid TEXT PRIMARY KEY NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
