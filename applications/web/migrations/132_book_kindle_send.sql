-- Remember which books each user sent to a Kindle, so the UI can offer Resend.
-- Like book_drive_file, this is per user.
CREATE TABLE IF NOT EXISTS book_kindle_send (
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  book_uuid TEXT NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  address TEXT,
  PRIMARY KEY (user_id, book_uuid)
);
