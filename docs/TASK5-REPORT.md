# Task 5 report — PWA / Android / release operations

Implemented on 2026-10-05. **PWA files and Android setup are implemented; production deployment, installable Android application and release readiness remain BLOCKED.**

## Delivered

- Korean `어디서 만나` PWA manifest, 192/512 PNG icons and a dedicated maskable PNG, original geometric SVG source, reproducible Windows icon generation, Korean standalone offline page.
- Static-shell service worker with exact production precache allowlist and content-derived version; no API/map/private/runtime response caching, cookie-free install fetch, refused private/no-store/redirected/opaque responses, network navigation with static offline fallback, no forced activation during open work, and cleanup limited to this application's cache prefix.
- Post-Vite `scripts/build-pwa.mjs`, Cloudflare asset freshness headers, strict explicit production identity/DAL generator, installed-tool-only Android preflight/init/build commands and Android setup/device/signing checklist.
- Fail-closed release checker for empty/unverified catalog, routing approval/evidence, production domain/package/Play certificate, operator contact/name, missing/stale DAL, missing build files, missing TWA config, APK/AAB outputs and physical-device evidence.
- Deployment operations covering separate real environment bindings/secrets, local-versus-remote D1, staging migration/restore rehearsal, privacy-safe logs, quota/outage handling, and rollback without deleting the production database.

No `assetlinks.json` or generated Android project is checked in because a real origin, package and Play certificate were not supplied. `android/README.md` and scripts are setup deliverables, not Android build artifacts. No domain purchase, SDK install, public deploy, remote migration, Play upload or paid action was taken.

## Verification

Node 24.21.0 portable runtime, Windows. Added tests failed initially for absent implementation, then passed after implementation.

| Check | Observed result |
| --- | --- |
| `node --test tests/pwa-android.test.mjs` / final full suite | Seven new tests covered by final suite |
| `npm test` in task5 checkout | **31 passed, 0 failed** (includes catalog/routing/client tests available on this branch) |
| `npm run typecheck` | Exit 0 |
| `npm run build` then `node scripts/build-pwa.mjs` | Exit 0; ten cached static artifacts, generated version `3017cce1c0267e1bea0b` on this branch |
| PNG decoding/header dimensions and manifest references | 192×192, 512×512 and maskable 512×512 pass; 512px icon visually inspected |
| `node scripts/check-release.mjs` | Expected exit **1**, fifteen blockers; no false release pass |
| `powershell -NoProfile -File scripts/android.ps1 preflight` | Expected exit **1**, explicit identity absent; no project generation |
| `git diff --check` | Exit 0 |

SW tests execute the real worker code in a VM with browser cache/network boundary stubs. They prove filtering/fallback/installation logic, not actual browser installation or Android lifecycle. Root integration must wire the manifest links, production SW registration and postbuild script; these shared edits were coordinated with the root owner. Actual browser offline/navigation/cache inspection remains an integration check. Server/worker/D1 verification belongs to integration because those files were absent in this task5 checkout.

## Exact external blockers

1. Owned public HTTPS origin and Cloudflare deployment/account bindings not supplied; D1 local placeholder must not be used remotely.
2. Permanent Android package ID, Play App Signing SHA-256, upload-key custody/backups and Play account access not supplied.
3. Installed Bubblewrap/JDK/Android SDK and adequate disk space not prepared; no APK or AAB exists.
4. Physical Android device, Play-signed internal distribution and link/lifecycle validation not performed. Desktop tests do not replace these.
5. Verified catalog currently has zero hubs; official-source preview points are not review approval.
6. Live provider usage rights, routing adoption evidence, full-scale timing, real journeys and production quota/budget remain unresolved.
7. Real public operator name/contact, final privacy/store data, deployment/rollback rehearsal and explicit launch decision remain unresolved.

The release checker is structural preflight. It checks evidence file existence and build ZIP signatures, not truth of evidence or Android signature validity. Human review of the signed artifacts, actual remote association, provider terms, test results and final launch decision remains required.
