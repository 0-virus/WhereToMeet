# Deployment and release operations

Status: **not deployed; release blocked**. The repository supports local development. The checked-in all-zero D1 UUID is a local placeholder, not a remote database. No provider contract, production account/domain, reviewed catalog, signing identity, real routing acceptance, physical Android validation or public launch approval can be inferred from passing fixture tests. No remote migration, public deployment, paid installation or Play upload was performed.

## Local verification

Use Node 24. Do not install another SDK/browser on the current disk-constrained machine. The existing portable Node can be added to the current session's `PATH`.

```powershell
npm run typecheck
npm test
npm run build
npm run db:migrate
npm run worker:check
npm run test:e2e
node scripts/check-release.mjs
```

`build` must run Vite followed by `node scripts/build-pwa.mjs`. The release checker exits 1 while blockers remain. It checks verified catalog membership/counts, explicit routing approval and evidence path, valid origin/package/certificate, real operator/contact, built web files, matching built DAL, generated TWA identity, nonempty APK/AAB ZIP artifacts and a device-evidence path. These structural checks do **not** verify signing cryptography, evidence truth, account entitlement, live domain ownership or approval to publish. A nonempty test report is not live validation evidence.

Before running the checker for a candidate release, export `APP_ORIGIN`, `ANDROID_PACKAGE_ID`, `PLAY_APP_SIGNING_SHA256`, `VITE_OPERATOR_NAME`, `VITE_OPERATOR_CONTACT`, `ROUTING_APPROVED=true`, `ROUTING_APPROVAL_FILE`, and `ANDROID_VALIDATION_FILE`. Point the last two at reviewed real evidence reports. Only set `ROUTING_APPROVED=true` after the routing owner has accepted the measurements and supplier usage rights. The Worker uses the same routing gate; do not open it to bypass blocked validation. See [routing protocol](ROUTING-VALIDATION.md) and [Android setup](../android/README.md).

## Web hosting and privacy boundaries

Workers Static Assets serves `dist` and uses SPA fallback so public hub links resolve on direct navigation. `/api/*` is worker-first: API misses and failures must remain JSON errors, never a successful HTML fallback. Browser requests use the same origin; no API key is passed in a URL. All API responses must retain `Cache-Control: no-store`. Do not add CDN Cache Rules, Workers Cache or a proxy that caches API, Kakao, TravelTime, history or private responses. [Cloudflare routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)

The service worker only precaches `/index.html`, the explicit offline page, manifest, icons, and generated JS/CSS/font files. A content digest covers all cached bytes and the worker implementation. Installation fetches omit credentials and refuse redirects, opaque, private, no-store and cookie-setting responses. Fetch handling never writes API/navigation/network responses into caches. Query-bearing assets and remote map/provider resources bypass the cache. Offline navigation serves the static shell; searches and history still require the network. This design must remain static-only: do not inject user data into `index.html`.

An updated worker waits until all old app windows close. It does not interrupt a form or an in-flight search with `skipWaiting`. On activation it removes only obsolete `wheretomeet-shell-*` caches. Reopen the app to take the update. `_headers` keeps the worker and manifest fresh; deploy verifies the actual headers because worker-generated responses require headers in Worker code. [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)

Keep automatic invocation URL logs disabled (`observability.logs.invocation_logs: false`). Restrict custom logs to safe error codes, coarse status/timing/call counts and request IDs. Never log input names, addresses, coordinates, raw provider bodies, URLs with search queries, cookies, tokens or API keys. Review actual Cloudflare logs, Logpush, proxy/CDN analytics and exception reporting before enabling production observability; local configuration alone cannot prove deployed privacy. History stores allowed origins under hashed anonymous session ownership with the approved retention rules; this is distinct from anonymous `search_events`. Route responses are never persisted.

## Remote preparation — owner decision required

Configure separate named `staging` and `production` Wrangler environments (or separate reviewed config files). Each must specify the real account/domain, its own D1 binding/UUID, independently configured `RATE_LIMITER` namespace and quota, provider entitlement/budget, routing flag and secrets. Bindings and variables must be reviewed per environment; do not assume inheritance. Keep the local all-zero D1 ID only for local work. Restrict the public Kakao JavaScript key to the exact allowed web origins. Put server-only Kakao REST and TravelTime keys into that environment's Worker secrets, never a `VITE_` variable or committed file.

Record a release manifest before touching a remote environment: Git revision, built shell version, approved hub catalog version/count, target environment/domain, Worker deployment/version ID, D1 database ID and current migration list, API quota, previous stable revision, operator/contact and evidence paths. Review `wrangler deploy --dry-run --env <environment>` and usage/cost before approval. No remote environment is configured in this checkout.

After the user authorizes the concrete deployment, the operator selects the named environment and database. The following are command forms, not values to run unchanged:

```powershell
npx wrangler d1 migrations list <database-name> --env <environment> --remote
npx wrangler d1 time-travel info <database-name> --env <environment>
npx wrangler d1 export <database-name> --env <environment> --remote --output <private-backup-path>
npx wrangler d1 migrations apply <database-name> --env <environment> --remote
npx wrangler deploy --env <environment>
```

First rehearse migrations, backup/restore and old-code compatibility on local and isolated staging data. Inspect the target database ID before applying. Save the backup privately with restricted access and retention because history contains personal data. Record the pre-migration Time Travel bookmark and confirm that account's recovery window. Never copy real histories into tests. [D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/), [migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)

Verify HTTPS, direct public hub links, valid JSON/content type at `/.well-known/assetlinks.json` without redirect/authentication, manifest/icons, service-worker scope, worker freshness, `/api/*` routing, no-store responses, secure HttpOnly SameSite history cookie, ownership isolation, map attribution, public privacy/operator information, daily expiry and quota behavior. Recheck actual server logs with synthetic inputs. A verified domain association is required for TWA; a reachable web page alone is insufficient.

## Rollback and incident actions

Keep a last-known-good Worker/static-assets/catalog revision and a compatible database migration state. A Worker rollback or redeploy of the reviewed stable revision restores code/assets; **never delete the production database to roll back code**. Prefer additive schema changes so the previous code remains compatible. If a migration damaged data, stop writes, involve the designated owner, review impact and use the recorded D1 recovery bookmark/backup only after a staging restore rehearsal. Recovery can discard writes since the selected point; it is a separate incident decision, not an automatic code rollback.

For provider outage, exhausted entitlement or invalid routing evidence, set the routing gate closed and deploy the reviewed maintenance configuration; keep a clear unavailable/429/503 response. Do not substitute fake or stale routes. Investigate sanitized failure codes, provider hit counts and latency; confirm recovery before reopening. Monitor D1 read/write/storage use, failed history writes, `search_events` inserts, and daily 90-day cleanup. Bookmarked history remains until deletion; removing the last bookmark after expiry deletes the record. A history write failure must stay visible without suppressing the recommendation.

For release readiness, attach real 20×100 comparisons (at least 95% within 180 seconds; zero unreachable recommendations), full-catalog performance with quota waits separated, bus/rail/mixed evidence, ten real journeys and physical web/Android cases. Include supplier usage permission, confirmed operational cost, Play account requirements, store screenshots/description/Data safety answers, real privacy/contact information, key custody, rollback rehearsal and explicit final launch decision. Current fixture/local results do not satisfy those gates.
