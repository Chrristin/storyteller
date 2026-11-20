-- The Archive ("the backroom"): a book can be set aside for everyone. It stays
-- in the library with all its files and data, but is hidden everywhere except
-- the Archive view. NULL means the book is not archived.
ALTER TABLE book
ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_book_archived_at ON book (archived_at);
