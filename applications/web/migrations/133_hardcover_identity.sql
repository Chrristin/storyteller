-- What Hardcover says each book really is: series, position, genres and moods.
-- Kept apart from the book's own metadata. Nothing here changes a book until
-- the owner accepts it (status becomes 'accepted' when it was applied).
--
-- The Hardcover token is not stored here. It is the one saved for the metadata
-- providers (settings.hardcoverApiToken, encrypted).
CREATE TABLE IF NOT EXISTS hardcover_identity (
  book_uuid TEXT PRIMARY KEY NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sure', 'check', 'none', 'accepted', 'error')
  ),
  hardcover_id TEXT,
  matched_title TEXT,
  matched_authors TEXT,
  series_name TEXT,
  series_position REAL,
  genres TEXT,
  moods TEXT,
  checked_at TEXT,
  accepted_at TEXT,
  error TEXT,
  source_query TEXT
);

CREATE INDEX IF NOT EXISTS idx_hardcover_identity_status ON hardcover_identity (status);
