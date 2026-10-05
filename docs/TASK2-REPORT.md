# Task 2 routing implementation — 2026-10-05

Implemented the production routing engine and the validation-only adapter. **Local checks pass; supplier adoption and launch remain BLOCKED.** No live credentials, reviewed journey observations, or actual supplier responses were available for this task.

## Integration contract

- `createTravelTimeProvider({ appId, apiKey, fetchImpl?, now?, signal?, maxHits?, beforeRequest? })` in `server/travel-time.ts` creates one request-scoped provider. `beforeRequest(hits)` runs before every HTTP attempt, including retries. `provider.hits` counts search hits actually started; reservations that fail or time out do not count as started calls.
- `recommend(request, hubs, provider, { maxCandidates? })` in `server/recommend.ts` returns at most four recommendations. Default candidate limit is 100 and default hit limit is 120; neither truncates a candidate set. Exceeding a processing budget fails the entire search with 503. The account quota must be configured independently in the API.
- `RoutingError` exposes fixed safe message, `code`, and `status`. Provider quota is 429; malformed/rejected responses are 502; unavailable/configuration/processing-budget errors are 503; deadline is 504; cancellation is 499. Controlled `RoutingError`s from the quota callback retain their code/status. Other callback errors become safe `quota_unavailable` errors.
- Provider methods are `reachable(request,hubs,seconds)`, `matrix(request,hubs)`, `check()`, and `now()`. Matrix returns unranked candidate route inputs; final timestamp validation belongs to `rankCandidates`, called immediately before the engine/adapter return.
- `createRoutingValidationAdapter` matches `scripts/validation/types.ts` exactly. Its matrix returns the complete ranked set; recommend keeps the four-result cap. Only this CLI adapter uses the explicitly named extended-deadline factory; normal provider creation always fixes the total budget at 30 seconds.

## Implemented safeguards

Forward maps use departure `D-T`, travel allowance `T`, public transport and 900-second walking setting, with no range, polygon filtering, hole removal or invented buffer. Shells, holes, multiple polygons and boundary points are preserved through Turf. Identical coordinates share one map search while every participant keeps their own score. Exact origin/destination coordinates yield the explicit zero route at `D`.

Upper bounds expand 30/60/120/240 minutes, capped by available departure time; bisection stops at a 180-second interval. Every observed pair of per-participant reachable sets is checked for monotonicity. Final high candidates are all revalidated using many-to-one arrival searches, ten searches per HTTP request, matched by opaque search/location IDs. If every final candidate is invalid, the engine enlarges high by 180 seconds once, within the current departure cap.

Ranking uses maximum burden, total burden, then stable hub ID; journey, early waiting and burden use actual route timestamps. Missing participant/route/time, late arrival, past departure, invalid arithmetic, duplicate identities and prohibited/unknown modes cannot produce a recommendation. Final ranking reads the clock again after provider work.

The deadline includes quota reservation, network, streamed body decoding and retry wait. Abort interrupts pending requests. Response bodies are capped at 8 MiB. Transient failures retry once; present `Retry-After` seconds or HTTP-date values are honored only when the delay fits the remaining deadline. Invalid or excessive delays are not bypassed. HTTP 429 retries only with an acceptable header. Provider error bodies and credentials never enter error messages or logs.

## Verification

Node 24.21.0, no new package installation:

```powershell
node --test tests/*.test.ts tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Latest complete run: **42 tests passed, 0 failed**; typecheck passed. This includes the existing ten validation-harness tests and 32 routing/provider/adapter tests. Meaningful RED-to-GREEN runs were observed for initial ranking, provider, engine, adapter, Retry-After delay/status handling, invalid numeric delay headers and the elapsed-clock cap regression. Tests use keyless external-provider fixtures; they do not measure live routing accuracy or latency.

Review follow-up: near-meeting searches now recalculate the available departure cap at every probe and use the actual sampled duration for expansion/bisection bounds. A clock tick between the engine calculation and provider preflight retries only after the cap demonstrably shrinks; provider past-departure validation remains intact. The regression reproduces a meeting 40 minutes ahead with a one-second first request, confirms probes of 1800/2399 seconds, and verifies per-participant monotonicity still fails on a lost hub.

Coverage includes polygon holes/boundaries/disconnected shapes, all-candidate batching, reversed response order, ranking ties/four cap/untruncated validation, duplicate coordinates, zero journeys, midnight, missing/late/past routes, mode rejection, monotonic failures, candidate/hit caps, canceled requests, stalled quota reservations, oversized/invalid responses, retry counts, Retry-After and safe errors.

## Supplier evidence and remaining blockers

The [regular matrix reference](https://docs.traveltime.com/api/reference/travel-time-distance-matrix) documents many-to-one arrival searches, ten searches per request and `route`/`travel_time`. Its arrival wording is still inconsistent with arrive-by semantics; actual late timestamps are always rejected. The [isochrone reference](https://docs.traveltime.com/api/reference/isochrones) documents forward departure searches and the four-hour standard allowance. The [official SDK route/transport types](https://github.com/traveltime-dev/traveltime-sdk-nodejs/blob/master/src/types/common.ts) list `walk`, `bus`, `rail_underground`, `rail_overground`, `rail_national`, `train`, `coach`, and other modes; `underground` alone is not a valid documented route mode.

The engine conservatively allows walk, bus, underground and overground rail response modes and rejects national/ambiguous train, coach, vehicle, ferry and unknown modes. However, the documented `public_transport` request has **no custom allowed-mode subset**. Bus/overground labels alone do not prove exclusion of intercity/express services. This prevents claiming compliance or adopting the algorithm from fixture checks; the API must remain behind the coordinator's `ROUTING_APPROVED` gate until supplier scope and real responses have been reviewed. Do not silently broaden the allowlist to generic `train`.

Still required: live 20×100 and full-catalog matrix comparisons, Korean seven-day timetable coverage, waiting/arrive-by semantics, at least ten bus/rail/mixed cases each, ten real journeys, reviewed meeting entrances, account throughput confirmation, real Workers CPU/memory and production latency. See `docs/ROUTING-VALIDATION.md`. Coordinator was notified that the harness fetch wrapper must preserve non-success HTTP responses and recognize safe typed routing codes so it does not distort production retry behavior.
