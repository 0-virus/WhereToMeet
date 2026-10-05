# Implementation ledger

Plan: [IMPLEMENTATION.md](IMPLEMENTATION.md). Updated 2026-10-05.

Six task-specific agents worked in isolated worktrees, up to three concurrently. Shared contracts and dependencies were exchanged during implementation; scoped commits were integrated into `implementation`.

| Task | Implemented | Acceptance still blocked |
|---|---|---|
| 0 | 20-scenario/100-hub comparison CLI, full-catalog mode, sanitized usage/accuracy reports | Actual provider credentials, quota/rights, real comparisons and journeys |
| 1 | Node/toolchain, sourced catalog normalization, provenance and review gates; 600 preview candidates and 100-point sample | All candidates need review; release catalog has zero hubs; regional coverage/count target |
| 2 | Forward isochrones, bounded search, complete arrival validation and ranking, deadlines/retries | Actual Korean transport coverage, accuracy and production-scale latency |
| 3 | Worker APIs, D1 migrations, anonymous history/bookmarks, retention, global quota, private-data-safe telemetry | Production bindings/secrets, deployed privacy and recovery rehearsal |
| 4 | Korean responsive app, input/results/details/history, map fallback, public sharing, accessibility basics | Actual Kakao map, physical mobile browsers and screen reader verification |
| 5 | Static-only PWA, offline behavior, Android configuration/build commands and release gates | Domain/package/signing identity, SDK/tools, generated signed APK/AAB and physical TWA validation |

Integration includes browser→Worker→SQL history and ownership tests, offline service-worker checks, local D1 migrations, Worker dry-run, and separate core/app reviews. Results and remaining requirements are recorded in [검증결과.md](검증결과.md) and [SCENARIOS.md](SCENARIOS.md). Local fixture results do not establish deployment readiness.

Review fixes cover routing clock drift, truthful accuracy denominators, bounded response observation, cancelable quota waits, canceled history persistence, concurrent expiry deletion, renewing anonymous cookies, and late UI bookmark responses. Detailed task reports retain the evidence at each handoff; the consolidated report is authoritative for integrated verification.

Environment: portable Node 24.21.0; existing Chrome; one browser worker to avoid resource exhaustion. Automatic approval review rejected recursive cleanup of downloaded browser/dependency directories, so those files remain. No user files were removed. A later test-server cleanup rejection was resolved by rechecking exact process identities before terminating only the test servers.

No remote deployment, paid subscription, Play upload or real-route success is claimed. User-supplied external settings and evidence remain pending.
