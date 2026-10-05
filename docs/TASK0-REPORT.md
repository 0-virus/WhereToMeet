# Task 0 report

Implemented the standalone routing validation CLI, 20 future-date public-origin scenarios, validation adapter contract, and 10 regression tests. The CLI compares isochrone recommendations with the complete arrival matrix over 100 or all supplied hubs; records request/search hits, quota waiting, latency, timestamp semantics, safety checks and per-origin monotonicity; and emits sanitized JSON with explicit blockers.

Validation on Node 24.21.0: all 10 routing-validation tests passed; targeted strict TypeScript check passed. Initial test run failed before the script existed. Keyless preflight produced `BLOCKED`, zero provider requests, no route samples, and null latency/accuracy metrics. Node 22 strip-types also passed the first eight tests before Node 24 became available.

Official docs were reviewed. The Matrix arrival introduction says “no earlier than”, while TravelTime's route-selection explanation says latest departure for arrive-by searches; actual timestamps remain authoritative for safety. Public Suwon, Incheon and Seongnam coordinates are sourced in [ROUTING-VALIDATION.md](./ROUTING-VALIDATION.md).

External blockers: TravelTime keys and confirmed quota, reviewed catalog, actual bus/rail/mixed journeys and transport-scope review, ten real user journeys, and live performance/semantics evidence. The production adapter is an explicit task 2 integration dependency, not a fabricated engine. No live API validation or deployment-readiness claim is made.

Adapter contract commit: `b0e194c`. Remaining implementation is committed separately for coordinator cherry-pick. Ownership stayed within scripts/validation, routing fixture/tests, and task 0 docs; shared.ts and product code were not edited.

## Core review fixes

Synced the integration branch before editing, preserving independent source-backed origins, HTTP-error passthrough, and documented rail-mode metrics. Accuracy now uses only baseline-routable scenarios, reports empty agreements separately, fails missed routable results, and blocks when no routable evidence exists.

Response observation now uses a backpressured stream with an 8 MiB capture limit. It leaves malformed JSON and oversized-response decisions to the production parser. A real-provider regression reproduced the previous malformed-JSON discrepancy (wrapped: two requests/503 versus direct: one request/502) and now confirms parity. An oversized stream stops near the production limit rather than being fully buffered first. Safe reporting preserves the actual monotonicity and candidate-budget error codes.

Quota waits are abortable, including an injected stalled sleep; already-aborted and canceled queued requests do not count hits or start network calls. The six added regression tests were observed failing before their fixes. Final Node 24.21.0 checks: **17 harness tests passed; 45 combined harness/provider/recommendation tests passed; full project TypeScript check passed**. No dependency installation or live API call was needed. External live-evidence blockers remain unchanged.
