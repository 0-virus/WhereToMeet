import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScenarios, compareResults, monotonicityLosses, percentile, selectHubs, summarize, validateRecommendations, createMeasuredFetch } from '../scripts/validate-routing.ts';
import { scenarioDefinitions } from './fixtures/routing-scenarios.ts';
import type { Hub, Recommendation } from '../src/shared.ts';

const now = Date.parse('2026-10-05T03:00:00Z');
const hub = (id: string, name = id): Hub => ({ id, name, lat: 37.5, lng: 127, regionCode: '11', kind: 'rail', sourceId: id, sourceUrl: 'https://example.org', sourceDate: '2026-10-01', verified: true });
const catalog = [...new Set(scenarioDefinitions.flatMap(s => s.origins))].map(name => hub(name, name));
const at = '2026-10-06T06:00:00Z';
const recommendation = (id: string, seconds: number): Recommendation => ({ hubId: id, maxBurdenSeconds: seconds, sumBurdenSeconds: seconds * 2, participantRoutes: ['p1', 'p2'].map(originId => ({ originId, departureAt: new Date(Date.parse(at) - seconds * 1000).toISOString(), arrivalAt: at, travelSeconds: seconds, earlyWaitSeconds: 0, burdenSeconds: seconds, transfers: 0 })) });

test('20 public-origin scenarios use the next suitable KST date within seven days', () => {
  for (const reference of [now, Date.parse('2026-10-09T14:50:00Z')]) {
    const scenarios = buildScenarios(catalog, reference);
    assert.equal(scenarios.length, 20);
    for (const s of scenarios) {
      assert.ok(Date.parse(s.request.meetingAt) > reference);
      assert.ok(Date.parse(s.request.meetingAt) <= reference + 7 * 86400000);
      assert.ok(s.request.origins.length >= 2 && s.request.origins.length <= 4);
      assert.equal(new Set(s.request.origins.map(o => o.id)).size, s.request.origins.length);
    }
  }
});
test('fixed public origins are independent of destinations; fewer than 100 hubs blocks validation', () => {
  assert.equal(buildScenarios([], now).length, 20);
  assert.throws(() => selectHubs([hub('a')], 100), /CATALOG_TOO_SMALL/);
});
test('100-hub sampling is stable across input order and rejects duplicate IDs', () => {
  const hubs = Array.from({ length: 120 }, (_, i) => hub(`h${i}`));
  assert.deepEqual(selectHubs(hubs, 100), selectHubs([...hubs].reverse(), 100));
  assert.throws(() => selectHubs([...hubs, hubs[0]], 100), /CATALOG_INVALID/);
});

test('the shipped 100-hub sample can schedule every scenario independently of destination selection', () => {
  const sample = JSON.parse(readFileSync(new URL('../data/hubs.sample.json', import.meta.url), 'utf8'));
  assert.equal(buildScenarios(sample.hubs, now).length, 20);
});
test('comparison detects missing results, excess error, and unsafe extra hubs', () => {
  assert.equal(compareResults([recommendation('a', 1180)], [recommendation('b', 1000), recommendation('a', 1180)]).within180Seconds, true);
  assert.equal(compareResults([recommendation('a', 1181)], [recommendation('b', 1000), recommendation('a', 1181)]).within180Seconds, false);
  assert.equal(compareResults([], [recommendation('b', 1000)]).within180Seconds, false);
  assert.equal(compareResults([], []).within180Seconds, true);
  assert.equal(compareResults([recommendation('x', 900)], [recommendation('b', 1000)]).unvalidatedRecommendations, 1);
});
test('route validation rejects missing participants, late arrival, past departure and false totals', () => {
  const valid = recommendation('a', 1000);
  const input = { origins: ['p1', 'p2'].map(id => ({ id, label: id, lat: 37.5, lng: 127 })), meetingAt: at };
  assert.equal(validateRecommendations([valid], input, [hub('a')], now), 0);
  for (const mutate of [
    (r: Recommendation) => r.participantRoutes.pop(),
    (r: Recommendation) => { r.participantRoutes[0].arrivalAt = '2026-10-06T06:01:00Z'; },
    (r: Recommendation) => { r.participantRoutes[0].departureAt = '2026-10-04T06:01:00Z'; },
    (r: Recommendation) => { r.sumBurdenSeconds = 0; },
  ]) { const changed = structuredClone(valid); mutate(changed); assert.equal(validateRecommendations([changed], input, [hub('a')], now), 1); }
});
test('monotonicity checks each participant, even when the intersection hides a loss', () => {
  assert.equal(monotonicityLosses([{ seconds: 900, reachable: { p1: ['a', 'b'], p2: [] } }, { seconds: 1800, reachable: { p1: ['a'], p2: ['a'] } }]), 1);
});
test('empty/partial runs never pass; percentiles are nearest rank', () => {
  assert.equal(percentile([1, 2, 3, 4, 100], .95), 100);
  assert.equal(percentile([], .5), null);
  assert.equal(summarize([], [], true).status, 'BLOCKED');
});
test('measured fetch preserves HTTP errors for the production retry policy without logging their bodies', async () => {
  const measured = createMeasuredFetch({ appId: 'secret-id', apiKey: 'secret-key', hitsPerMinute: 100, fetchImpl: async () => new Response('private-origin secret-key', { status: 401 }) });
  const response = await measured.fetch('https://api.traveltimeapp.com/v4/time-filter', { method: 'POST', body: JSON.stringify({ arrival_searches: [{ id: 'a' }, { id: 'b' }] }) });
  assert.equal(response.status, 401);
  assert.equal(measured.metrics.requests, 1);
  assert.equal(measured.metrics.hits, 2);
  assert.doesNotMatch(JSON.stringify(measured.metrics), /secret|private-origin/);
});
test('quota pacing uses search hits and preserves separate waiting time', async () => {
  let clock = 100000;
  const measured = createMeasuredFetch({ appId: 'x', apiKey: 'y', hitsPerMinute: 10, now: () => clock, sleep: async ms => { clock += ms; }, fetchImpl: async () => { clock += 5; return Response.json({ results: [] }); } });
  const request = { method: 'POST', body: JSON.stringify({ arrival_searches: Array.from({ length: 10 }, (_, i) => ({ id: String(i), arrival_time: at })) }) };
  await measured.fetch('https://api.traveltimeapp.com/v4/time-filter', request);
  await measured.fetch('https://api.traveltimeapp.com/v4/time-filter', request);
  assert.equal(measured.metrics.hits, 20);
  assert.equal(measured.metrics.networkMs, 10);
  assert.equal(measured.metrics.quotaWaitMs, 59996);
  await assert.rejects(() => measured.fetch('https://example.com/v4/time-filter', request), /PROVIDER_ENDPOINT_REJECTED/);
});
test('raw timestamp semantics become aggregate observations only', async () => {
  const payload = { results: [{ search_id: 'h', locations: [{ id: 'private-origin', properties: [{ travel_time: 900, route: { departure_time: '2026-10-06T05:40:00Z', arrival_time: '2026-10-06T05:55:00Z', parts: [{ mode: 'bus' }, { mode: 'rail_underground' }] } }] }] }] };
  const measured = createMeasuredFetch({ appId: 'x', apiKey: 'y', hitsPerMinute: 10, fetchImpl: async () => Response.json(payload) });
  await measured.fetch('https://api.traveltimeapp.com/v4/time-filter', { body: JSON.stringify({ arrival_searches: [{ id: 'h', arrival_time: at }] }) });
  assert.equal(measured.metrics.earlyArrivalSamples, 1);
  assert.equal(measured.metrics.travelTimeEqualsJourney, 1);
  assert.equal(measured.metrics.travelTimeEqualsBurden, 0);
  assert.equal(measured.metrics.mixedRoutes, 1);
  assert.doesNotMatch(JSON.stringify(measured.metrics), /private-origin|2026/);
});
