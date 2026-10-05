# Task 4 — Korean mobile web

Implemented the approved input → comparison → destination flow in React/TypeScript. White/ink/rausch design, responsive cards and pill search, native system fonts, accessible labels, keyboard autocomplete, focusable error/result regions, and reduced-motion support. No stock/fabricated photos, ratings, production fixtures, or stored route responses.

## Delivered

- Two to four selected place inputs; editing a label invalidates its coordinates; abortable debounced autocomplete with keyboard selection. Explicit KST date conversion independent of device timezone, future/seven-day validation.
- At most four recommendation cards, maximum burden and each participant's departure, arrival, travel, early wait and transfers. Calculation timestamp and stale-departure notice.
- Request cancellation, duplicate-request guard, abandoned-history-restore cancellation, offline, quota, provider, expired-record and history-write failures. Missing history bookmark data cannot overwrite existing bookmarks.
- Lazy map module and click-triggered restricted Kakao SDK (`VITE_KAKAO_JS_KEY`), load timeout, retry and permanent external map fallback. Nearby categories fetch only after explicit selection, with an 800m explanation and cap of 15.
- Public `/meet/:hubId` pages containing no personal origins or meeting date. Malformed percent encoding is handled in React. Web Share cancellation, clipboard success, clipboard denial/manual selection. External places restricted to credential-free HTTPS Kakao origins.
- Anonymous server history, fresh owned-record lookup before every restore, automatic recalculation for valid future meetings, new-time requirement for past meetings, favorites-first order, independently reachable bookmarked public hubs, bookmark removal and individual/all confirmed deletion.
- `/privacy` and footer link describe anonymous cookies, server origin/meeting storage, 90-day normal retention, indefinite bookmarked retention, deletion, separate 90-day search summaries, no persisted routes, providers, and operator contact explicitly awaiting setup.

## Verification — 2026-10-05

- `npm test`: 4 UI client tests passed in this isolated worktree. It contains no other agents' unit tests; the integration branch must run the combined suite.
- `npm run typecheck`: passed.
- `npm run build`: passed. Lazy map bundle ~1.84 kB (0.92 kB gzip); main bundle ~251.39 kB (78.51 kB gzip); CSS ~18.96 kB (4.60 kB gzip).
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=2`: 17 passed, 38.2 seconds. Uses installed Chrome, 360×800, America/Los_Angeles device timezone, mocked API responses. Includes 768/1280 layouts and 200% CSS zoom.
- Meaningful regression failures were reproduced for malformed URL handling, abandoned history restore, zoom overflow, and unsafe external URL credentials; corrected checks now pass. Early harness issues (pre-existing unrelated server on 5173 and foundation JSON BOM) were identified and isolated. E2E owns strict port 4174 and never reuses an unrelated server.
- Inspected generated 360px home/results and 1280px home screenshots. Generated screenshots are intentionally local artifacts, not source assets:
  - `C:/Users/PC/Projects/WhereToMeet/.worktrees/task4/test-results/mobile-home.png`
  - `C:/Users/PC/Projects/WhereToMeet/.worktrees/task4/test-results/mobile-results.png`
  - `C:/Users/PC/Projects/WhereToMeet/.worktrees/task4/test-results/home-768.png`
  - `C:/Users/PC/Projects/WhereToMeet/.worktrees/task4/test-results/home-1280.png`
  - Regenerate with `CAPTURE_UI=1` plus the E2E command.

## External / integration verification still required

Mocked browser flows are not proof of TravelTime/Kakao data quality or real API availability. Real Kakao SDK/domain-key validation, real provider routes and journeys, Android Chrome/Samsung Internet/iOS Safari devices, screen reader review and deployed Workers/D1 cookie/ownership behavior remain for integration/device validation. Vite rejects the raw malformed `/meet/%` URL before serving HTML; the React guard is tested by setting the URL before app boot. Deployed asset fallback should also be checked for this path. Operator identity/contact is not supplied and remains setup required. PWA/service worker/Android assets belong to task 5 and are not fabricated here.

The worktree normalized the foundation package.json BOM locally to permit Vite builds. That package change is deliberately excluded from this task commit; coordinator commit `3a2c1b3` owns it.
