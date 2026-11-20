-- Pairs of books that must never be joined automatically. A split ("Split into
-- separate books") records the two books it produced here, so the linker does
-- not propose or merge them again. The pair is stored in a canonical order
-- (book_a_uuid < book_b_uuid), so (a, b) and (b, a) are the same row. A manual
-- merge is not blocked, and removes the row.
CREATE TABLE IF NOT EXISTS book_join_exclusion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_a_uuid TEXT NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  book_b_uuid TEXT NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (book_a_uuid < book_b_uuid),
  UNIQUE (book_a_uuid, book_b_uuid)
);

CREATE INDEX IF NOT EXISTS idx_book_join_exclusion_b ON book_join_exclusion (book_b_uuid);
