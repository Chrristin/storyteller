-- A separate "Unread" status for books that merely arrived, so they can be told
-- apart from books the user explicitly put on the "To read" list.
--
-- 1. Add the status "Unread" if no status has that name yet.
-- 2. Make it the library default (only when it exists).
-- 3. ONE TIME: every book_to_status row (of every user) that is "To read"
--    becomes "Unread". Skipped when no status named "To read" exists.
INSERT INTO
  status (name, label, is_default)
SELECT
  'Unread',
  'Unread',
  0
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      status
    WHERE
      name = 'Unread'
  );

UPDATE status
SET
  is_default = CASE
    WHEN name = 'Unread' THEN 1
    ELSE 0
  END
WHERE
  EXISTS (
    SELECT
      1
    FROM
      status
    WHERE
      name = 'Unread'
  )
  AND is_default IS NOT (name = 'Unread');

UPDATE book_to_status
SET
  status_uuid = (
    SELECT
      uuid
    FROM
      status
    WHERE
      name = 'Unread'
    LIMIT
      1
  )
WHERE
  status_uuid = (
    SELECT
      uuid
    FROM
      status
    WHERE
      name = 'To read'
    LIMIT
      1
  )
  AND EXISTS (
    SELECT
      1
    FROM
      status
    WHERE
      name = 'Unread'
  );
