# Routing validation

Status on 2026-10-05: **BLOCKED — no live API evidence**. The harness and its fixture tests are implemented. They do not establish Korean transport coverage, routing accuracy, production latency, or launch readiness. No paid service was activated.

## Run

Use Node 24. From the repository root:

```powershell
node --test tests/routing-validation.test.ts
node scripts/validate-routing.ts --preflight-only --catalog data/hubs.sample.json
node --env-file=.env scripts/validate-routing.ts --mode compare --catalog data/hubs.sample.json --out artifacts/routing-validation.json
node --env-file=.env scripts/validate-routing.ts --mode compare --catalog data/hubs.preview.json --catalog-size all --out artifacts/routing-full-catalog.json
```

The live commands require `TRAVELTIME_APP_ID`, `TRAVELTIME_API_KEY`, and `TRAVELTIME_HITS_PER_MINUTE` in the local environment file. Set the hit limit to the account's confirmed entitlement; the harness does not guess it. `--hits-per-minute` overrides that limit. Credentials are passed in headers by the production adapter, never in URLs or reports. Do not commit the environment file.

`--mode isochrone` and `--mode matrix` support isolated measurements. Only `compare` provides paired quality evidence; single-mode runs remain blocked for adoption. A missing catalog, unresolved public station, unavailable adapter, missing key, or missing confirmed quota is an explicit blocker. Exit codes are 0 for a fully satisfied summary, 1 for measured failure, and 2 for blocked/incomplete evidence. The current CLI deliberately retains human-review blockers even after a successful live batch; adopt the algorithm only after the review below is recorded.

Node 22 can run the script/tests with `--experimental-strip-types` as a temporary development fallback. Node 24.21.0 was used for the final targeted checks.

## Adapter and measurement contract

`scripts/validation/types.ts` defines `createRoutingValidationAdapter(options)` exported by `server/validation-adapter.ts` (overridable with `--adapter`). It delegates to the production engine:

- `recommend(request, hubs)` returns at most four recommendations.
- `matrix(request, hubs)` evaluates **all** supplied hubs and returns every valid ranked hub, without the UI result cap.
- `reachable(request, hubs, seconds)` returns each participant's reachable hub IDs using forward departure at `D-seconds` and that travel allowance.

The injected fetch counts every started HTTP attempt and search hit, including retries. It allows only the regular TravelTime `/v4/time-map` and `/v4/time-filter` endpoints, paces requests through a rolling 60-second hit budget, and limits each HTTP call to 30 seconds. Canceled quota waits settle promptly without starting or counting the queued request. Non-success HTTP responses pass unchanged to the production adapter, preserving classification and `Retry-After`. The CLI adapter gets an explicit 24-hour validation deadline to accommodate free-tier pacing. Production handlers must retain their independent **30-second total search deadline**; the CLI must never enable its extended deadline in the HTTP application.

Successful response bodies pass through a backpressured observation stream. Observation retains at most 8 MiB, matching the production parser's byte limit, and never consumes a cloned body ahead of it. Malformed JSON is left for the production parser to reject; observation failures cannot change its status or retry count. Current engine error codes, including `non_monotonic_reachability` and `routing_candidate_budget_exceeded`, survive sanitized reporting.

Per-scenario elapsed time includes quota waiting. Service time subtracts measured local quota waits, and still includes API calls, streamed response transfer, retry work, decoding, and ranking. The `networkMs` counter measures the fetch wait until response headers; full body processing remains included in service time. The report gives nearest-rank p50/p95, average/max hits and request totals separately for each algorithm. Probe calls are separate from recommendation latency. `totalUsage` also includes calls consumed by a failed stage, whose complete timing sample may be unavailable. A timeout/error is not a successful latency sample. This controlled CLI service measurement does not replace a Workers production-deadline or CPU/memory test.

## Scenarios and provenance

`tests/fixtures/routing-scenarios.ts` defines exactly 20 repeatable scenarios: 2–4 participants, duplicate origins, weekday/weekend meetings, early and late service, midnight, and Seoul–Suwon–Incheon–Seongnam combinations. Times are the next suitable Asia/Seoul local calendar occurrence more than four hours ahead and within seven days. The report records the scheduling reference and each attempted meeting timestamp. A long batch that crosses a usable departure time fails explicitly; regenerate future scenarios for a rerun.

Seoul station origins preserve exact coordinates from named records in the checked-in official station master snapshot (record IDs appear in fixture provenance). They are independent of the destination sample, so excluded transfer stations do not prevent scheduling. Separate public origins preserve these source coordinates:

| Public origin | Source |
| --- | --- |
| Suwon Messe, near Suwon Station | [Korea Tourism Organization location record](https://data.visitkorea.or.kr/linkedview/3075791) |
| Incheon Open Port street | [Korea Tourism Organization location record](https://data.visitkorea.or.kr/linkedview/947611) |
| Gwonsun Learning Center | [Suwon Youth and Young Adult Foundation directions](https://yeyak.syf.or.kr/www/119) |
| Pangyo Station west bus stop 07-455; Taepyeong 2-dong administrative center stop 05-058 | [Seongnam public-location coordinate table](https://www.seongnam.go.kr/contents/down/10458_9.pdf) |

Sources were inspected on 2026-10-05. The Seongnam PDF was available through indexed table extraction; direct retrieval timed out. These are public test coordinates, **not field-reviewed meeting entrances**. Bus/mixed scenario tags describe the intended investigation; they do not prove the provider chose those modes. Do not count tags toward the ten real bus, rail, and mixed cases required by the execution plan.

The initial destination selection is 100 deterministic points spread across catalog entries ordered by region, kind, and stable ID. Input order does not change the selection. `--catalog-size all` tests the full actual catalog. A preview with `verified:false` may be measured, but remains blocked for release. Duplicate IDs, invalid coordinates, fewer than 100 destinations, or missing station origins fail preflight. Repeated platform entries in an upstream catalog still require catalog-owner deduplication review.

## Comparisons and safeguards

For each scenario the harness runs the production isochrone recommendation and full Arrival Matrix at the same future meeting time and over the same hubs. The primary error is the isochrone winner's maximum burden minus the full-matrix winner's maximum burden. All 20 cases must be compared, and at least 95% of cases where the matrix finds a valid route must be between zero and 180 seconds. `baselineRoutableScenarios` is this accuracy denominator. Missing isochrone results remain failures in that denominator. `emptyAgreements` counts two-empty outcomes separately; they do not improve accuracy or best-hub agreement. With no routable baseline evidence, accuracy is null and the run is `BLOCKED`. The report also records best-hub agreement and top-four overlap.

Every recommendation is independently checked for all expected participant IDs, valid timestamp order, departure still in the future, arrival by the meeting, exact travel/early-wait/burden arithmetic, totals, valid hub ID, and duplicate hubs. Isochrone results absent from the matrix, or with inconsistent burden totals, count as unvalidated. Such a discrepancy may reflect supplier timetable variation between calls; it still needs investigation and must not silently pass. Production route parsing additionally owns transport-mode restrictions.

Forward reachable sets are probed at 15, 30, **45**, 60, 120, and 240 minutes. Monotonicity is checked per participant, so an intersection cannot conceal a lost destination. These discrete samples can reveal violations but do not prove monotonicity for every time or location. Route timestamps are reduced to aggregate counters: early/late arrivals, whether `travel_time` equals the timestamp journey or total burden, bus/rail parts, and mixed routes. Raw routes, origin coordinates/labels, provider bodies, and keys are never saved by this harness.

Targets are p50 service latency ≤5 seconds, p95 ≤10 seconds, and no service measurement over 30 seconds. Failure of accuracy, completeness, monotonicity, or latency is reported as `FAIL`; unresolved human/provider evidence remains `BLOCKED` even when measured checks look good.

## Official supplier semantics checked on 2026-10-05

The [TravelTime direction explanation](https://help.traveltime.com/en/articles/9503877-how-do-departure-and-arrival-searches-differ) distinguishes outward departure isochrones from inward arrival isochrones. Origin-centered arrival polygons therefore solve the wrong direction for this product. The [model-selection explanation](https://help.traveltime.com/en/articles/8523982-how-do-the-models-determine-which-route-to-take) says arrival searches optimize latest departure and departure searches optimize earliest arrival.

The [regular Matrix reference](https://docs.traveltime.com/api/reference/travel-time-distance-matrix) documents many-to-one arrival searches, up to 10 searches per request, and `route`/`travel_time` properties. One search is required per destination hub. Its introductory arrival-search sentence currently says “no earlier than”, inconsistent with the intended arrive-by semantics in the SDK and help material. This is an unresolved documentation contradiction, not proof that late arrivals are acceptable. The harness and engine must inspect actual timestamps and reject arrival after `D`.

The [isochrone reference](https://docs.traveltime.com/api/reference/isochrones) and [route example](https://docs.traveltime.com/api/start/routes) define shapes and timestamp-bearing route properties. Documentation alone does not prove initial-wait inclusion, monotonicity, seven-day Korean timetables, walking connections, or exclusion of intercity/express rail and coaches. Request settings and real route parts require supplier/field review; a generic rail part counter cannot establish urban-rail scope.

## Evidence still required

| Gate | Current evidence |
| --- | --- |
| Harness comparison, future dates, sanitization, pacing | 17 local regression tests passed; fixture evidence only |
| Live 20 × 100 comparison and measured hits/latency | BLOCKED: credentials/confirmed account quota unavailable |
| Reviewed 100-hub and full-scale catalogs | BLOCKED: catalog review belongs to task 1 |
| Production adapter connection | Integrated; real provider parser/retry parity covered by keyless regression tests |
| Actual bus/rail/mixed routes, ≥10 each | BLOCKED: real route review absent |
| Ten real user journeys | BLOCKED: participant/device travel observations absent |
| Initial wait, early arrival, latest departure, urban-mode scope | BLOCKED: live responses/supplier confirmation absent |
| Workers 30-second deadline and full-catalog resources | Separate production/integration verification required |

Do not promote this report's fixture checks to live PASS. On a measured failure, retain the sanitized report and public fixture ID, reproduce with a new future date, and present the isochrone/full-Matrix tradeoff for a user decision. Do not silently change to departure-time routing or a narrower geography.
