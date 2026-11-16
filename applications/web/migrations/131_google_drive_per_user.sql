-- Google Drive sync becomes per user. The server owner still saves one Google
-- OAuth client (google_drive_config keeps client_id and client_secret), but each
-- user signs in with their own Google account and has their own folder and
-- their own record of which books were copied.
--
-- Anyone who connected under the first version has to connect again: the old
-- sign-in belonged to the whole server, and there is no way to know which user
-- it was meant for.
CREATE TABLE IF NOT EXISTS google_drive_connection (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  refresh_token TEXT,
  account_email TEXT,
  folder_id TEXT,
  oauth_state TEXT,
  oauth_redirect_uri TEXT,
  oauth_state_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE google_drive_config
DROP COLUMN refresh_token;

ALTER TABLE google_drive_config
DROP COLUMN account_email;

ALTER TABLE google_drive_config
DROP COLUMN folder_id;

ALTER TABLE google_drive_config
DROP COLUMN oauth_state;

ALTER TABLE google_drive_config
DROP COLUMN oauth_redirect_uri;

ALTER TABLE google_drive_config
DROP COLUMN oauth_state_at;

DROP TABLE IF EXISTS book_drive_file;

CREATE TABLE book_drive_file (
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  book_uuid TEXT NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_uuid)
);
