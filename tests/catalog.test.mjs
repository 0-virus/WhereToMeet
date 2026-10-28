import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { normalizeSources, validateCatalog, reviewFingerprint, makeCatalog, sampleHubs } from '../scripts/build-hubs.mjs';

import * as catalog from '../scripts/build-hubs.mjs';

const rail = (id, name, lat = '37.5', lot = '127.0') => ({ bldn_id: id, bldn_nm: name, lat, lot, route: 'test' });
const bus = (id, name, lat = 37.51, lng = 127.01, type = '중앙차로') => ({ NODE_ID: id, ARS_ID: '01001', name, lat, lng, type });

test('normalization keeps source IDs/coordinates and never implies review', () => {
  const result = normalizeSources({ rail: [rail('001', ' 역 A ')], bus: [bus(123, '버스 A')] });
  assert.deepEqual(result.hubs.map(h => [h.id, h.name, h.lat, h.lng, h.verified, h.regionCode]), [
    ['seoul-bus-123', '버스 A', 37.51, 127.01, false, 'unreviewed'],
    ['seoul-rail-001', '역 A', 37.5, 127, false, 'unreviewed'],
  ]);
});

test('invalid coordinates and unsupported ferry/nontrunk buses are quarantined', () => {
  const result = normalizeSources({ rail: [rail('1', 'swapped', '127', '37'), rail('2', 'blank', '', '127')], bus: [bus(1, 'ferry', 37.5, 127, '한강선착장'), bus(2, 'local', 37.5, 127, '마을버스')] });
  assert.equal(result.hubs.length, 0);
  assert.equal(result.excluded.length, 4);
});

test('ambiguous repeated names or coordinates are excluded instead of padded/merged', () => {
  const result = normalizeSources({ rail: [rail('1', 'transfer'), rail('2', 'transfer', '37.5001'), rail('3', 'other')], bus: [] });
  assert.equal(result.hubs.length, 0);
  assert.equal(result.excluded.length, 3);
});

test('duplicate source ID fails rather than overwriting a record', () => {
  assert.throws(() => normalizeSources({ rail: [rail('1', 'A'), rail('1', 'B')], bus: [] }), /duplicate source ID/);
});

test('release validation rejects unreviewed, duplicate and out of range hubs', () => {
  const h = normalizeSources({ rail: [rail('1', 'A')], bus: [] }).hubs[0];
  assert.throws(() => validateCatalog(makeCatalog([h])), /unreviewed/);
  assert.throws(() => validateCatalog(makeCatalog([h, h]), { preview: true }), /duplicate/);
  assert.throws(() => validateCatalog(makeCatalog([{ ...h, lat: 127 }]), { preview: true }), /coordinates/);
  assert.throws(() => validateCatalog(makeCatalog([])), /empty/);
});

test('only complete source-matched review evidence enables release status', () => {
  const input = { rail: [rail('1', 'A')], bus: [] };
  const h = normalizeSources(input).hubs[0];
  const review = { regionCode: '11', reviewer: 'fixture reviewer', reviewedAt: '2026-10-05', evidence: ['https://example.test/review'], pedestrianAccessChecked: true, representativePointChecked: true, fingerprint: reviewFingerprint(h) };
  const approved = normalizeSources(input, { [h.id]: review }).hubs[0];
  assert.equal(approved.verified, true);
  assert.doesNotThrow(() => validateCatalog(makeCatalog([approved])));
  assert.throws(() => normalizeSources(input, { [h.id]: { ...review, pedestrianAccessChecked: false } }), /review/);
  assert.throws(() => normalizeSources(input, { [h.id]: { ...review, reviewedAt: '2026-99-99' } }), /review/);
  assert.throws(() => normalizeSources({ rail: [rail('1', 'A', '37.6')], bus: [] }, { [h.id]: review }), /stale review/);
});

test('stable ordering and evenly distributed sample are independent of input order', () => {
  const input = { rail: [rail('2', 'B', '37.6'), rail('1', 'A')], bus: [bus(1, 'C')] };
  const a = normalizeSources(input).hubs;
  const b = normalizeSources({ rail: input.rail.toReversed(), bus: input.bus }).hubs;
  assert.deepEqual(makeCatalog(a), makeCatalog(b));
  assert.equal(sampleHubs(a, 2).length, 2);
  assert.throws(() => sampleHubs(a, 100), /not enough/);
});

test('checked-in sample has 100 distinct real source points and honest preview status', async () => {
  const sample = JSON.parse(await readFile(new URL('../data/hubs.sample.json', import.meta.url), 'utf8'));
  assert.equal(sample.hubs.length, 100);
  assert.equal(new Set(sample.hubs.map(h => h.id)).size, 100);
  assert.equal(new Set(sample.hubs.map(h => `${h.lat},${h.lng}`)).size, 100);
  assert.ok(sample.hubs.every(h => h.verified === false));
  assert.equal(sample.hubs.filter(h => h.kind === 'bus').length, 50);
  const rail = JSON.parse(await readFile(new URL('../data/raw/seoul-rail-20261002.json', import.meta.url), 'utf8')).DATA;
  const busRows = JSON.parse(await readFile(new URL('../data/raw/seoul-bus-20260902.json', import.meta.url), 'utf8'));
  for (const h of sample.hubs) {
    const source = h.kind === 'rail' ? rail.find(r => r.bldn_id === h.sourceId) : busRows.find(r => r.NODE_ID === h.sourceId);
    assert.ok(source, `${h.id} needs a real source record`);
    assert.equal(h.lat, Number(source.lat));
    assert.equal(h.lng, Number(h.kind === 'rail' ? source.lot : source.lng));
  }
  assert.doesNotThrow(() => validateCatalog(sample, { preview: true }));
});

test('default release command fails closed without changing the release artifact', async () => {
  const path = new URL('../data/hubs.json', import.meta.url);
  const before = await readFile(path, 'utf8');
  const result = spawnSync(process.execPath, ['scripts/build-hubs.mjs'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unreviewed hub/);
  assert.equal(await readFile(path, 'utf8'), before);
});


test('checked-in sample excludes points outside the approved service regions', async () => {
  const sample = JSON.parse(await readFile(new URL('../data/hubs.sample.json', import.meta.url), 'utf8'));
  const evidence = JSON.parse(await readFile(new URL('../data/review-evidence/preview-2026-10-28.json', import.meta.url), 'utf8'));
  for (const h of sample.hubs) {
    const check = evidence.results.find(r => r.hubId === h.id);
    assert.ok(check, h.id);
    assert.ok(['11', '28', '41'].includes(check.legalCode.slice(0, 2)), h.id + ' is outside service region');

    assert.equal(h.verified, false);
  }
});

function regionCheck(h, code) {
  return { hubId:h.id, fingerprint:reviewFingerprint(h), legalCode:code, regionCode:code.slice(0,2), httpStatus:200, queriedAt:'2026-10-28T12:00:00.000Z' };
}

test('region checks exclude outside points without approving pedestrian access', () => {
  const input=normalizeSources({rail:[rail('1','서울'),rail('2','충남','36.81')],bus:[]});
  const result=catalog.applyRegionChecks(input,[regionCheck(input.hubs[0],'1111010100'),regionCheck(input.hubs[1],'4413110100')]);
  assert.deepEqual(result.hubs.map(h=>[h.id,h.regionCode,h.verified]),[['seoul-rail-1','11',false]]);
  assert.equal(result.excluded.length,1);
  assert.equal(result.excluded[0].id,'seoul-rail-2');
  assert.match(result.excluded[0].reason,/outside service region/);
  assert.equal(input.hubs.length,2);
  assert.equal(input.hubs[0].regionCode,'unreviewed');
});

test('region checks reject missing, duplicate, unknown, stale or malformed evidence', () => {
  const input=normalizeSources({rail:[rail('1','서울')],bus:[]});
  const good=regionCheck(input.hubs[0],'1111010100');
  for(const rows of [[],[good,good],[{...good,hubId:'unknown'}],[{...good,fingerprint:'old'}],[{...good,httpStatus:429}],[{...good,legalCode:'11'}],[{...good,regionCode:'41'}],[{...good,queriedAt:'invalid'}]]) {
    assert.throws(()=>catalog.applyRegionChecks(input,rows),/region check/);
  }
  assert.throws(()=>catalog.applyRegionChecks({...input,hubs:[{...input.hubs[0],lat:37.6}]},[good]),/region check/);
});

test('region evidence cannot silently contradict an approved review', () => {
  const h={...normalizeSources({rail:[rail('1','서울')],bus:[]}).hubs[0],verified:true,regionCode:'11'};
  assert.throws(()=>catalog.applyRegionChecks({hubs:[h],excluded:[]},[regionCheck(h,'4413110100')]),/region check/);
  assert.equal(catalog.applyRegionChecks({hubs:[h],excluded:[]},[regionCheck(h,'1111010100')]).hubs[0].verified,true);
});
