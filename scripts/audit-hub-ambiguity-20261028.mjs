// 2026-10-28 격리 레코드 대조. 거리·이름 일치는 대표점 승인이나 병합 근거가 아니다.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { normalizeSources, reviewFingerprint } from './build-hubs.mjs';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const manifest = await json('data/sources.json');
const sourceFiles = ['data/raw/seoul-rail-20261002.json', 'data/raw/seoul-bus-20260902.json'];
const sources = [];
for (const path of sourceFiles) {
  const source = manifest.sources.find(s => s.files.some(f => f.path === path));
  const sha256 = createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
  assert.equal(sha256, source.files.find(f => f.path === path).sha256, path);
  sources.push({ path, sha256, sourceUrl: source.sourceUrl, sourceDate: source.sourceDate });
}
const rail = (await json(sourceFiles[0])).DATA;
const bus = await json(sourceFiles[1]);
const result = normalizeSources({ rail, bus });
const reason = 'ambiguous repeated name or coordinate; representative-point review required';
const ids = result.excluded.filter(r => r.reason === reason).map(r => r.id).sort();
assert.equal(ids.length, 583);
assert.deepEqual(ids, (await json('data/quality-report.json')).excluded.filter(r => r.reason === reason).map(r => r.id).sort());
const excluded = new Set(ids);
const records = [];
for (const [kind, rows] of [['rail', rail], ['bus', bus]]) {
  for (const row of rows) {
    const id = `seoul-${kind}-${kind === 'rail' ? row.bldn_id : row.NODE_ID}`;
    if (!excluded.has(id)) continue;
    const hub = normalizeSources({ rail: kind === 'rail' ? [row] : [], bus: kind === 'bus' ? [row] : [] }).hubs[0];
    assert(hub && hub.id === id);
    records.push({ ...hub, ...(kind === 'rail' ? { route: row.route } : { arsId: row.ARS_ID }) });
  }
}
assert.equal(records.length, ids.length);
const distance = (a, b) => {
  const rad = Math.PI / 180;
  const v = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lng-a.lng)*rad/2)**2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(v)));
};
assert.equal(distance({ lat: 37, lng: 127 }, { lat: 37, lng: 127 }), 0);
assert(Math.abs(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111194.9266) < 0.001);
const byName = new Map(), byCoordinate = new Map();
for (const h of records) {
  for (const [map, key] of [[byName, `${h.kind}:${h.name}`], [byCoordinate, `${h.lat},${h.lng}`]]) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(h);
  }
}
const groups = [...byName].filter(([, members]) => members.length > 1).map(([key, members]) => {
  members.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  let max = -1, pair;
  for (let i = 0; i < members.length; i++) for (let j = i+1; j < members.length; j++) {
    const meters = distance(members[i], members[j]);
    if (meters > max) { max = meters; pair = [members[i].id, members[j].id]; }
  }
  return { key, kind: members[0].kind, name: members[0].name,
    maxStraightLineMeters: Math.round(max*10)/10, farthestPair: pair,
    members: members.map(h => ({ hubId: h.id, fingerprint: reviewFingerprint(h),
      ...(h.kind === 'rail' ? { route: h.route } : { arsId: h.arsId }) })) };
}).sort((a, b) => b.maxStraightLineMeters-a.maxStraightLineMeters || a.key.localeCompare(b.key, 'en'));
const coordinateGroups = [...byCoordinate.values()].filter(rs => rs.length > 1)
  .map(rs => rs.map(h => h.id).sort()).sort((a, b) => a[0].localeCompare(b[0], 'en'));
// 이 스냅샷의 동일 좌표 그룹은 모두 동명 그룹에도 속한다. 새 형태는 재검수가 필요하다.
assert.deepEqual(groups.flatMap(g => g.members.map(h => h.hubId)).sort(), ids);
assert.equal(groups.length, 278);
assert.equal(coordinateGroups.length, 3);
assert.equal(groups.find(g => g.key === 'rail:양평').maxStraightLineMeters, 53551.3);
const report = {
  checkedAt: '2026-10-28', sources,
  method: '기존 normalizeSources의 격리 ID를 원본과 대조하고, 같은 교통수단·정규화 이름별로 묶었다. WGS84 좌표의 구면 Haversine 거리(반지름6371000m) 중 그룹 내 최대값을 계산했다. 내림차순은 공간 분산 확인 순서이며 이용 수요·출시 채택 우선순위가 아니다.',
  limitations: ['직선거리는 보행거리·환승 연결·동일 역·공통 만남 공간을 증명하지 않는다.',
    '원본 레코드 수와 실제 독립 만남 지점 수를 구분한다. 같은 좌표도 자동 병합하지 않는다.',
    '지역 법정동·대표점·보행 접근성·운영 상태는 이번 격리 그룹에서 검증하지 않았다.'],
  summary: { excludedRecords: ids.length, railRecords: records.filter(r => r.kind === 'rail').length,
    busRecords: records.filter(r => r.kind === 'bus').length, nameGroups: groups.length,
    railNameGroups: groups.filter(g => g.kind === 'rail').length, busNameGroups: groups.filter(g => g.kind === 'bus').length,
    coordinateGroups: coordinateGroups.length, releaseApprovalsAdded: 0 },
  coordinateGroups, groups,
};
await writeFile(new URL('data/review-evidence/ambiguous-hubs-2026-10-28.json', root), JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify(report.summary));
