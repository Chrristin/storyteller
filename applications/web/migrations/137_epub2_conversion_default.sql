-- EPUB 2 files are converted to EPUB 3 on import by default. Storyteller can
-- only read EPUB 3, so skipping them leaves the book out of the library.
--
-- Only the "skip" choice is changed. Anything else the user picked (convert
-- alongside, replace in place, backup and convert) is left as it is.
UPDATE settings
SET
  value = '"backup-and-convert"'
WHERE
  name = 'epub2ImportStrategy'
  AND value = '"skip"';

-- A folder rule that says "skip" falls back to the default again.
UPDATE import_rule
SET
  epub2_import_strategy = NULL
WHERE
  epub2_import_strategy = 'skip';
