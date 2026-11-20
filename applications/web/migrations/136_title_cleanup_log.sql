-- The title a book had before a clean-up changed it, so the clean-up can be
-- undone. One row per changed book; rows of one run share a batch_id. A row is
-- marked undone (not deleted) once its old title has been put back.
CREATE TABLE IF NOT EXISTS title_cleanup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_uuid TEXT NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  old_title TEXT NOT NULL,
  new_title TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  batch_id TEXT NOT NULL,
  undone_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_title_cleanup_log_batch ON title_cleanup_log (batch_id);
CREATE INDEX IF NOT EXISTS idx_title_cleanup_log_book ON title_cleanup_log (book_uuid);
