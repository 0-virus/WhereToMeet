import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const SNAPSHOT_AT = '2026-10-05T00:00:00.000Z';
const SOURCES = {
  rail: { sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do', sourceDate: '2026-10-02' },
  bus: { sourceUrl: 'https://data.seoul.go.kr/dataList/OA-15067/S/1/datasetView.do', sourceDate: '2026-09-02' },
};
const compare = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const coordinateValid = (h) => Number.isFinite(h.lat) && Number.isFinite(h.lng) && h.lat >= 36.8 && h.lat <= 38.3 && h.lng >= 124.5 && h.lng <= 127.9;
const clean = (value) => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function reviewFingerprint(hub) {
  return createHash('sha256').update(JSON.stringify([hub.id, hub.name, hub.lat, hub.lng, hub.sourceDate])).digest('hex');
}

export function normalizeSources({ rail, bus }, reviews = {}) {
  const seen = new Set();
  const excluded = [];
  const candidates = [];
  for (const [kind, records] of [['rail', rail], ['bus', bus]]) {
    for (const row of records) {
      const sourceId = clean(kind === 'rail' ? row.bldn_id : row.NODE_ID);
      const id = `seoul-${kind}-${sourceId}`;
      if (!sourceId) throw new Error('missing source ID');
      if (seen.has(id)) throw new Error(`duplicate source ID: ${id}`);
      seen.add(id);
      const lat = row.lat;
      const lng = kind === 'rail' ? row.lot : row.lng;
      const h = { id, name: clean(kind === 'rail' ? row.bldn_nm : row.name), lat: clean(lat) ? Number(lat) : NaN, lng: clean(lng) ? Number(lng) : NaN, regionCode: 'unreviewed', kind, sourceId, ...SOURCES[kind], verified: false };
      let reason;
      if (!h.name || !coordinateValid(h)) reason = 'invalid or outside broad capital-area coordinate envelope';
      // Central-lane stops are only a reproducible trunk-bus candidate proxy;
      // route connectivity and pedestrian access still require manual review.
      else if (kind === 'bus' && row.type !== '중앙차로') reason = 'not a central-lane trunk-bus candidate';
      if (reason) excluded.push({ id, reason });
      else candidates.push(h);
    }
  }
  const nameCounts = new Map();
  const coordinateCounts = new Map();
  for (const h of candidates) {
    const nameKey = `${h.kind}:${h.name}`;
    const coordinateKey = `${h.lat},${h.lng}`;
    nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1);
    coordinateCounts.set(coordinateKey, (coordinateCounts.get(coordinateKey) ?? 0) + 1);
  }
  const hubs = [];
  for (const h of candidates) {
    if (nameCounts.get(`${h.kind}:${h.name}`) > 1 || coordinateCounts.get(`${h.lat},${h.lng}`) > 1) {
      excluded.push({ id: h.id, reason: 'ambiguous repeated name or coordinate; representative-point review required' });
      continue;
    }
    const review = reviews[h.id];
    if (review) {
      if (review.fingerprint !== reviewFingerprint(h)) throw new Error(`stale review: ${h.id}`);
      if (!['11', '28', '41'].includes(review.regionCode) || !clean(review.reviewer) || !validDate(review.reviewedAt) || !Array.isArray(review.evidence) || !review.evidence.length || !review.evidence.every(e => typeof e === 'string' && /^https:\/\//.test(e)) || review.pedestrianAccessChecked !== true || review.representativePointChecked !== true) throw new Error(`incomplete review: ${h.id}`);
      h.regionCode = review.regionCode;
      h.verified = true;
    }
    hubs.push(h);
  }
  for (const id of Object.keys(reviews)) if (!hubs.some(h => h.id === id)) throw new Error(`review refers to excluded or missing hub: ${id}`);
  return { hubs: hubs.sort(compare), excluded: excluded.sort(compare) };
}

export function applyRegionChecks(result, checks) {
  if (!Array.isArray(checks)) throw new Error('invalid region checks');
  const byId = new Map();
  for (const check of checks) {
    if (!check || typeof check.hubId !== 'string' || byId.has(check.hubId)) throw new Error('duplicate or invalid region check');
    byId.set(check.hubId, check);
  }
  const hubs = [];
  const excluded = [...result.excluded];
  for (const h of result.hubs) {
    const check = byId.get(h.id);
    if (!check || check.fingerprint !== reviewFingerprint(h)) throw new Error(`missing or stale region check: ${h.id}`);
    if (check.httpStatus !== 200 || typeof check.legalCode !== 'string' || !/^\d{10}$/.test(check.legalCode) || check.regionCode !== check.legalCode.slice(0, 2) || !Number.isFinite(Date.parse(check.queriedAt))) throw new Error(`invalid region check: ${h.id}`);
    if (h.verified && h.regionCode !== check.regionCode) throw new Error(`region check conflicts with review: ${h.id}`);
    byId.delete(h.id);
    if (!['11', '28', '41'].includes(check.regionCode)) {
      excluded.push({ id:h.id, reason:'outside service region according to source-matched legal district evidence' });
      continue;
    }
    hubs.push({ ...h, regionCode:check.regionCode });
  }
  if (byId.size) throw new Error('region check refers to excluded or missing hub');
  return { hubs:hubs.sort(compare), excluded:excluded.sort(compare) };
}

export function makeCatalog(hubs) {
  const ordered = [...hubs].sort(compare);
  const digest = createHash('sha256').update(JSON.stringify(ordered)).digest('hex').slice(0, 12);
  return { version: `seoul-20261005-${digest}`, generatedAt: SNAPSHOT_AT, hubs: ordered };
}

export function validateCatalog(catalog, { preview = false } = {}) {
  if (!catalog.hubs.length) throw new Error('empty release catalog');
  const ids = new Set();
  const points = new Set();
  for (const h of catalog.hubs) {
    if (ids.has(h.id)) throw new Error(`duplicate hub ID: ${h.id}`);
    if (points.has(`${h.lat},${h.lng}`)) throw new Error(`duplicate coordinates: ${h.id}`);
    ids.add(h.id);
    points.add(`${h.lat},${h.lng}`);
    if (!coordinateValid(h)) throw new Error(`invalid coordinates: ${h.id}`);
    if (!h.id || !h.name || !h.sourceId || !/^https:\/\//.test(h.sourceUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(h.sourceDate) || !['rail', 'bus'].includes(h.kind)) throw new Error(`invalid provenance: ${h.id}`);
    if (!preview && (h.verified !== true || !['11', '28', '41'].includes(h.regionCode))) throw new Error(`unreviewed hub: ${h.id}`);
  }
}

export function sampleHubs(hubs, count = 100) {
  if (hubs.length < count) throw new Error(`not enough source hubs for ${count}-point sample`);
  const geographical = (a, b) => a.lat - b.lat || a.lng - b.lng || compare(a, b);
  const bus = hubs.filter(h => h.kind === 'bus').sort(geographical);
  const rail = hubs.filter(h => h.kind === 'rail').sort(geographical);
  const busCount = Math.min(bus.length, Math.max(Math.floor(count / 2), count - rail.length));
  const select = (rows, n) => Array.from({ length: n }, (_, i) => rows[Math.floor(i * rows.length / n)]);
  return [...select(bus, busCount), ...select(rail, count - busCount)].sort(compare);
}

async function main() {
  const preview = process.argv.includes('--preview');
  if (process.argv.slice(2).some(a => a !== '--preview')) throw new Error('Usage: node scripts/build-hubs.mjs [--preview]');
  const json = async (path) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
  const [rail, bus, reviews, regionEvidence] = await Promise.all([json('data/raw/seoul-rail-20261002.json'), json('data/raw/seoul-bus-20260902.json'), json('data/reviews.json'), json('data/review-evidence/preview-2026-10-28.json')]);
  const { hubs, excluded } = applyRegionChecks(normalizeSources({ rail: rail.DATA, bus }, reviews), regionEvidence.results);
  const catalog = makeCatalog(hubs);
  validateCatalog(catalog, { preview });
  const save = async (path, data) => writeFile(new URL(path, ROOT), `${JSON.stringify(data, null, 2)}\n`);
  if (preview) {
    await save('data/hubs.preview.json', catalog);
    await save('data/hubs.sample.json', makeCatalog(sampleHubs(hubs)));
    await save('data/quality-report.json', { sourceCounts: { rail: rail.DATA.length, bus: bus.length }, candidateCount: hubs.length, verifiedCount: hubs.filter(h => h.verified).length, kinds: { rail: hubs.filter(h => h.kind === 'rail').length, bus: hubs.filter(h => h.kind === 'bus').length }, regionStatus: 'Source-matched Kakao legal districts in 11/28/41; representative-point and pedestrian reviews remain separate', excluded });
  } else {
    await save('data/hubs.json', catalog);
  }
  console.log(`${preview ? 'PREVIEW only' : 'RELEASE'}: ${hubs.length} hubs, ${hubs.filter(h => h.verified).length} reviewed, ${excluded.length} excluded`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Catalog build failed: ${error.message}`); process.exitCode = 1; });
}
