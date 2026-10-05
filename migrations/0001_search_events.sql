CREATE TABLE search_events (
 request_id TEXT PRIMARY KEY NOT NULL,
 searched_at TEXT NOT NULL,
 participant_count INTEGER NOT NULL CHECK(participant_count BETWEEN 2 AND 4),
 status TEXT NOT NULL CHECK(status IN ('success','no_routes','error','cancelled')),
 error_code TEXT,
 recommended_hub_ids_json TEXT NOT NULL CHECK(json_valid(recommended_hub_ids_json) AND json_type(recommended_hub_ids_json) = 'array' AND json_array_length(recommended_hub_ids_json) <= 4),
 traveltime_hits INTEGER NOT NULL CHECK(traveltime_hits >= 0),
 duration_ms INTEGER NOT NULL CHECK(duration_ms >= 0),
 algorithm_version TEXT NOT NULL,
 data_version TEXT NOT NULL
);
CREATE INDEX search_events_searched_at ON search_events(searched_at);
