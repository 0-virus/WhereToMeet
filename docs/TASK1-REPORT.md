# Task 1 — foundation and catalog

Implemented Node 24 / React / TypeScript / Vite with a locked npm dependency tree, Workers static assets + D1 configuration, browser/server environment example, node:test and Playwright dependencies/scripts. Shared types were not changed. The D1 UUID is an explicit all-zero local placeholder; no account, paid subscription or remote deployment was created.

The first foundation commit is `04e5b5e`. Coordinator subsequently fixed its PowerShell UTF-8 BOM in `package.json`; that correction must remain in integration. The foundation's npm install reported 0 vulnerabilities. Toolchain runs used portable Node 24.21.0 supplied by the coordinator, without global changes.

Acquired two actual, licensed Seoul public sources and retained provenance, original bytes and hashes. Deterministic candidate normalization produces **600 unreviewed candidates (539 rail, 61 bus)** and **100 actual source points (50 each mode)**. A source fingerprint plus explicit evidence-bearing review record is required to set `verified: true`. The release catalog is empty and the default release command fails closed. Details, license attribution and rebuild/review instructions are in [data/README.md](../data/README.md).

## Verification

- `node --test tests/catalog.test.mjs`: **9 passed**, after observing failing tests before implementation/changes. Tests cover source preservation, invalid coordinates, ambiguous duplicate quarantine, duplicate source IDs, release rejection, stale/incomplete review evidence, deterministic ordering, the actual 100-point sample, and preserving release output on failed build.
- `npm test`: **9 passed** in the Task 1 worktree (catalog suite only; other tasks are isolated).
- `npm run typecheck`: **passed** for the foundation/shared types currently in this worktree.
- `python scripts/extract-hub-sources.py`: **11,236 records extracted**, source schema asserted, Python standard library only.
- `node scripts/build-hubs.mjs --preview`: **600 candidates, 0 reviewed, 11,420 exclusions**. Sample/source coordinate equality is checked in tests.
- `node scripts/build-hubs.mjs`: **expected exit 1**, `unreviewed hub: seoul-bus-100000001`; existing `hubs.json` remains untouched. This is a blocked acceptance condition, not a passing release build.
- Full frontend build, Worker dry-run, D1 migration and Playwright tests belong to integration because this worktree intentionally has no UI entrypoint, server handler or migrations. No temporary UI was committed and these checks are not claimed as passed here.

## Remaining release blockers

1. **0 verified hubs**, unknown administrative regions and no field/pedestrian-access verification. The API must report catalog unavailable rather than treat an empty release catalog as genuine no-routes. Never silently import `hubs.preview.json` for production recommendations.
2. **600 candidates vs. the 1,000–3,000 target**, with conservative exclusion of repeated station/stop names, incomplete outer-region bus coverage and no route-degree hub selection. Counts were not padded by duplicated platforms/stops.
3. KRIC source redistribution terms need clarification for the requested national railway source; the actual distributable dataset uses clearly licensed Seoul sources instead. No ambiguous KRIC snapshot was committed.
4. Actual provider validation of 20 × 100 scenarios, full catalog performance/CPU/memory, bus/rail/mixed cases and real traveler journeys remains external work. Source availability and synthetic unit tests cannot establish provider or journey accuracy.

The foundation and preview pipeline are reviewable; Task 1's reviewed release-catalog acceptance criterion is **BLOCKED**.
