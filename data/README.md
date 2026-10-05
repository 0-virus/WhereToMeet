# Hub catalog and source attribution

The release catalog `hubs.json` is deliberately empty: **no meeting point has completed administrative-region and pedestrian-access review**. Do not silently substitute a preview in production.

The two public sources are Seoul Metropolitan Government's [station master](https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do) and [bus stop positions](https://data.seoul.go.kr/dataList/OA-15067/S/1/datasetView.do), both marked **공공누리 제1유형 / KOGL Type 1**, allowing reuse and modification with attribution. Preserve this attribution when displaying/distributing derived data: **서울특별시 서울열린데이터광장, 서울시 역사마스터 정보·서울시 버스정류소 위치정보; 후보 추출 및 정규화**. Exact retrieval forms, source dates, original filenames and SHA-256 values are in `sources.json`. Originals stay in `raw/`; bus JSON is a reproducible extraction, not a different data supplier.

| Artifact | Count | Meaning |
| --- | ---: | --- |
| Source railway records | 784 | Source station/line records, not unique verified meeting points |
| Source bus records | 11,236 | Includes ordinary/local bus stops and ferry piers |
| `hubs.preview.json` | 600 | 539 rail and 61 bus candidates; **all unreviewed** |
| `hubs.sample.json` | 100 | 50 rail and 50 bus; geographic sampling within each mode, unreviewed |
| `hubs.json` | 0 | Release eligibility blocked |

`regionCode: "unreviewed"` means unknown, not Seoul. Seoul's datasets include metropolitan network records beyond the city. The broad 36.8–38.3°N, 124.5–127.9°E envelope is an error screen, **not an administrative boundary**. It cannot prove that a point belongs to Seoul, Gyeonggi, or Incheon.

## Rebuild and review

1. Use Node 24. `python scripts/extract-hub-sources.py` deterministically extracts the bundled bus XLSX using Python's standard library. No Excel installation is needed.
2. `npm run catalog:preview` writes the preview, sample and `quality-report.json`. It never writes `hubs.json`.
3. Review each adopted representative point against authoritative boundaries, station/stop plans and safe public pedestrian access. Add actual evidence to `data/reviews.json`, keyed by stable hub ID. The evidence must support the asserted checks; setting booleans is not review.
4. `npm run catalog:build` writes the release catalog only when every candidate passes review and structural validation. Its present failure is intentional. A failed build leaves the previous release artifact untouched.

Example review structure (illustration only; **not evidence**):

```json
{
  "seoul-rail-SOURCE_ID": {
    "regionCode": "11",
    "reviewer": "actual reviewer",
    "reviewedAt": "2026-10-05",
    "evidence": ["https://official.example/actual-point-review"],
    "pedestrianAccessChecked": true,
    "representativePointChecked": true,
    "fingerprint": "SHA-256 from reviewFingerprint(hub)"
  }
}
```

Allowed reviewed region codes are 11 (Seoul), 28 (Incheon), and 41 (Gyeonggi). `reviewFingerprint` is exported from `scripts/build-hubs.mjs`; it binds review to the source ID, normalized name, coordinates and source date. Changed points invalidate prior approval. Empty `reviews.json` is the current honest state.

## Selection and quality limits

- Stable IDs are `seoul-rail-{BLDN_ID}` and `seoul-bus-{NODE_ID}`; they do not depend on names or array positions. Coordinates are unchanged numeric source values, with no invented geocoding or centroids.
- Candidate bus selection uses the source `중앙차로` (central bus lane) classification as a reproducible trunk-bus proxy. It is **not** a route-degree ranking or proof of a good meeting point. Other buses and the eight ferry piers are excluded; major bus hubs outside this proxy may be missing.
- Repeated normalized names within a mode and identical coordinates are **quarantined**, not automatically merged. This deliberately omits many useful transfer stations and opposite-direction bus stops until representative-point curation. Names alone do not prove transfer connectivity or a shared pedestrian meeting place.
- Six source rows are outside the broad envelope or have invalid coordinates. 10,831 are outside the bus candidate class, and 583 have repeated names/coordinates. `quality-report.json` lists each exclusion by source ID and reason.
- The 100-point sample evenly selects latitude/longitude-sorted entries within each mode. It is a reproducible test set, not a statistically representative travel-demand sample or a manually verified acceptance set.
- The 600-candidate count is below the 1,000–3,000 target. Coverage is not metropolitan completeness; Incheon/Gyeonggi bus sources, route connectivity, authoritative region classification, transfer-point curation and pedestrian access remain unfinished. None of these are bypassed to meet a numeric target.
- KRIC's 2026-06-30 national source was inspected as requested. Its page did not provide clear file-specific reuse terms, while its general portal terms contain restrictions. It is not included in these distributable artifacts; clarify its applicable license before adding it.

Refresh monthly by downloading new dated snapshots, recording their license/provenance/hashes, adapting field extraction if necessary, and repeating review. Do not overwrite source dates or retain approvals for changed coordinates. `generatedAt` is fixed to the checked-in snapshot batch date and the version is content-hashed, so unchanged rebuilds are byte-for-byte deterministic.
