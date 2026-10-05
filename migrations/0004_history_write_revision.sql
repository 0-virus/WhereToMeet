-- Search writes and their cancellation compensation use optimistic concurrency.
-- Bookmark mutations do not change search revision; compensation preserves pins.
ALTER TABLE history ADD COLUMN write_revision TEXT NOT NULL DEFAULT '';
