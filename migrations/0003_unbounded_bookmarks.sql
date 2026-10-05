-- Recommendation count is capped at four; retained bookmarks may span searches.
CREATE TABLE history_updated (
 id TEXT PRIMARY KEY NOT NULL,
 owner_hash TEXT NOT NULL,
 origins_json TEXT NOT NULL CHECK(json_valid(origins_json)),
 meeting_at TEXT NOT NULL,
 searched_at TEXT NOT NULL,
 bookmarked_hub_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(bookmarked_hub_ids_json) AND json_type(bookmarked_hub_ids_json)='array')
);
INSERT INTO history_updated SELECT * FROM history;
DROP TABLE history;
ALTER TABLE history_updated RENAME TO history;
CREATE INDEX history_owner_date ON history(owner_hash,searched_at);
CREATE INDEX history_retention ON history(searched_at);
