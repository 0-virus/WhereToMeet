CREATE TABLE history (
 id TEXT PRIMARY KEY NOT NULL,
 owner_hash TEXT NOT NULL,
 origins_json TEXT NOT NULL CHECK(json_valid(origins_json)),
 meeting_at TEXT NOT NULL,
 searched_at TEXT NOT NULL,
 bookmarked_hub_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(bookmarked_hub_ids_json) AND json_array_length(bookmarked_hub_ids_json) <= 4)
);
CREATE INDEX history_owner_date ON history(owner_hash, searched_at);
CREATE INDEX history_retention ON history(searched_at);
-- Operational reservations deliberately separate from best-effort analytics.
CREATE TABLE quota_reservations (
 request_id TEXT PRIMARY KEY NOT NULL,
 owner_hash TEXT NOT NULL,
 reserved_hits INTEGER NOT NULL CHECK(reserved_hits > 0),
 active_until INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX quota_expiry ON quota_reservations(expires_at);
