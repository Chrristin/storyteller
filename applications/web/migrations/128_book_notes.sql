-- Notes on a book. A book can have many notes. Everyone who can see the book can
-- read every note on it; each note belongs to the user who wrote it, and only
-- that user can change or delete it.
CREATE TABLE IF NOT EXISTS book_note (
  uuid TEXT PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  book_uuid TEXT NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_book_note_book ON book_note (book_uuid, created_at);

CREATE INDEX IF NOT EXISTS idx_book_note_user ON book_note (user_id);

DROP TRIGGER IF EXISTS book_note_update_trigger;

CREATE TRIGGER book_note_update_trigger AFTER
UPDATE ON book_note FOR EACH ROW BEGIN
UPDATE book_note
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;
