# Task 3 server / D1 / history report

Implemented the shared HTTP contract in `server/app.ts`; `server/index.ts` wires the reviewed production catalog. Test dependency injection exists only in the worker factory, with no environment-triggered production fixture fallback. Task 2 owns the imported routing engine.

Security and behavior: input and timezone/date validation, 2–4 participants, distinct IDs, finite WGS84 coordinates, future ≤7 days, Kakao administrative region verification, fixed provider endpoints, trusted HTTPS place links, nearby 800m/15 results, no-store responses, safe fixed errors, same-Origin writes, one 30-second cancellation budget, catalog/routing/config gates.

History: 32-byte opaque Secure/HttpOnly/SameSite cookie; only its hash in D1; authorization before routing; automatic success/no_routes save; no route-response persistence; visible write-failure warning; bookmarks preserved across recalculation; bookmarks may span multiple searches; normal 90-day retention, bookmarked persistence and expired-last-unpin deletion; own record/all deletion. D1 retention and quota cleanup run daily.

Quota ruling: reserve the entire configured search hit budget for 90 seconds using one atomic D1 SQL statement, including the concurrency/owner checks; release its concurrency lease after history cleanup settles. The initial 35-second lease was extended to 90 seconds during integrated review to prevent a second canceled search from restoring the first canceled write while cleanup remains outstanding. This is intentionally conservative: lower throughput rather than unsafe refunds while cancellation/retry usage remains uncertain. Telemetry is not used as quota accounting. Production external-call endpoints additionally require the Cloudflare rate-limit binding; daily hashed network keys avoid raw IP storage.

Telemetry: strict column allowlist, max four public recommendation IDs, idempotent request ID, database status/count/nonnegative constraints, exact expiry boundary, background write failure isolation and fixed-code diagnostics. Logs never include raw error objects or user inputs.

Verification at task handoff:

- `node --test tests/server-api.test.ts tests/server-db.test.ts`: 14 passing.
- `tsc --noEmit`: passing with task 2 source copied only for local integration verification, excluded from this commit.
- Local Wrangler D1 migrations 0001/0002/0003: applied successfully; migration0003 preserves bookmark arrays beyond four.
- Full worktree `npm test`: 33 passing. `npm run typecheck`: passing.
- Worktree `npm run build` blocked because task 4 owns `index.html` and it is not present in this isolated branch; consequently `worker:check` cannot find `dist`. Coordinator integration must run both checks after combining frontend and server.

External blockers: reviewed production catalog is deliberately empty; actual supplier credentials/contracts/routing approval and live behavior, production DB/ratelimiter account binding, real HTTPS deployment and operational recovery remain unverified. This task does not authorize a public launch.

Operations and query examples: [운영준비.md](./운영준비.md).

## Review fixes

Forced-interleaving regressions reproduced late writes after cancellation and stale expiry deletion, then verified the fixes. Migration0004 adds a search write revision. Refresh writes use a bounded compare-and-swap loop; cancellation or ambiguous write errors compensate only the exact owned revision. Existing search fields are restored without reverting concurrent bookmarks or a newer successful search. The API tracks late persistence/compensation with `waitUntil` and delays lease release until it settles. Compensation database failure has its own fixed `HISTORY_ROLLBACK_FAILED` diagnostic; an unavailable database or terminated runtime cannot offer a transactional rollback guarantee and requires operational recovery.

Last-unpin deletion now evaluates current expiry and empty bookmarks atomically at deletion time. Existing anonymous cookies renew their one-year expiry on use without changing the token or security attributes.
