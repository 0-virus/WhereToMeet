# Approved implementation — 2026-10-05

Goal: implement WhereToMeet mobile web and Android TWA, verify all scenarios before claiming deployment readiness.
Spec: 20260923_실행계획.md and DESIGN-airbnb.md; decisions below override conflicting original requirements.

## Binding decisions
- React/TypeScript/Vite, Workers/D1 direct SQL, Kakao, TravelTime. Korean UI, Asia/Seoul time, 2–4 participants in Seoul/Gyeonggi/Incheon; future meeting within seven days.
- Rank by max burden seconds, sum burden seconds, stable hub ID. Return at most FOUR valid candidates, fewer if unavailable. Never fabricate routes.
- Server anonymous history via secure HttpOnly SameSite cookie. Hash token in DB; no accounts or cross-device sync. Separate history from anonymous search_events telemetry.
- History restores origins and always recalculates. Past meeting requires new time. No route-response persistence/caching. Normal history expires 90 days from last successful search; records with bookmarks persist until deleted. Last bookmark removal after expiry deletes record.
- Successful/no_routes searches save history; errors/cancellation do not. Recompute updates existing owned record only on success/no_routes. History write failure must be visible without destroying recommendation.
- Bookmark candidate hub IDs; records with bookmarks sort first, each group newest first. Individual/all deletion. Never expose other browser's records.
- Nearby radius 800m, max 15; categories restaurant/cafe/culture. Share public hub or external place only.
- Invalid 400, no_routes 200, quota 429, provider 502/503/504. 30s search budget. Retry transient provider failure once only within budget.
- API keys server only except public restricted Kakao JS key. No input coordinates/address/token in logs or shared URLs. API no-store. SW caches static shell only.
- Real API/device/user travel verification cannot be replaced by fixtures. Missing credentials/contracts/devices remain BLOCKED, not PASS. No paid subscriptions or public launch without user decision.

## Ownership / tasks
Task 0: scripts/validate-routing.ts, routing verification fixtures/tests and docs/ROUTING-VALIDATION.md. Actual supplier semantics and 20 x 100 comparison. Report external blockers.
Task 1: package/config/toolchain, data/**, scripts/build-hubs.mjs, catalog tests. Real sources; unreviewed data cannot be marked verified. Foundation owns shared types, with coordinator approval for changes.
Task 2: server/travel-time.ts, server/recommend.ts, recommendation/provider tests. Forward isochrones, binary search, holes/boundaries, all-candidate arrival validation.
Task 3: server/index.ts and server support modules excluding task2; migrations/**; API/D1/history tests. Quota, privacy, ownership, retention and failure isolation.
Task 4: src/** except shared.ts, index.html, frontend/E2E tests. Complete polished UI with map failure fallback, history, share, responsive accessibility.
Task 5: public/**, android/**, Android/PWA scripts/tests, docs/DEPLOYMENT.md. No invented domain/signing certificate.
Coordinator: shared contracts, integration, scenario matrix, release report and final browser/review validation.

## Execution
Max three child agents concurrently. Start 0/1/4; schedule 2/3/5 as slots free. Use isolated worktrees and commits, cherry-pick to integration branch. Share interface changes immediately. External preparations remain questions while independent work proceeds.

## Acceptance
Unit/integration node:test, typecheck, production build, local D1 migration and Playwright E2E. 360px/tablet/desktop, keyboard/zoom, invalid input, stale time, cancel/double-click, provider/map/storage errors, history expiry/ownership, share/direct-link, offline and Android lifecycle.
Real validation: 20 scenarios x 100 hubs, >=95% within 180 seconds of full Arrival Matrix; zero unreachable participant recommendations. Validate full actual catalog scale; report p50 <=5s/p95 <=10s and 30s timeout separately from free quota waits. At least 10 bus/rail/mixed cases each and 10 real user journeys per original plan. Actual Android signing/domain/AAB validation required.
