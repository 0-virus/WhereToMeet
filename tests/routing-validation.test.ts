import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScenarios, compareResults, monotonicityLosses, percentile, selectHubs, summarize, validateRecommendations, createMeasuredFetch, safeError } from '../scripts/validate-routing.ts';
import { scenarioDefinitions } from './fixtures/routing-scenarios.ts';
import type { Hub, Recommendation } from '../src/shared.ts';
import { createTravelTimeProvider, RoutingError } from '../server/travel-time.ts';

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
  assert.equal(compareResults([], []).within180Seconds, false);
  assert.equal(compareResults([], []).emptyAgreement, true);
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
test('empty agreement cannot conceal a missed routable scenario or establish accuracy', () => {
  const metrics = createMeasuredFetch({ appId: 'x', apiKey: 'y', hitsPerMinute: 10 }).metrics;
  const measurement = { elapsedMs: 0, serviceMs: 0, metrics };
  const empty = { scenarioId: 'empty', intent: 'test', status: 'MEASURED' as const, probes: measurement, isochrone: measurement, matrix: measurement, comparison: compareResults([], []) };
  const missed = { ...empty, scenarioId: 'missed', comparison: compareResults([], [recommendation('a', 1000)]) };
  const mostlyEmpty = summarize([...Array.from({ length: 19 }, () => empty), missed], [], true);
  assert.equal(mostlyEmpty.within180SecondsRate, 0);
  assert.equal(mostlyEmpty.status, 'FAIL');
  assert.equal(mostlyEmpty.emptyAgreements, 19);
  assert.equal(mostlyEmpty.baselineRoutableScenarios, 1);
  const onlyEmpty = summarize(Array.from({ length: 20 }, () => empty), [], true);
  assert.equal(onlyEmpty.within180SecondsRate, null);
  assert.equal(onlyEmpty.status, 'BLOCKED');
});
test('safe error reporting preserves current engine diagnostic codes only', () => {
  for (const code of ['non_monotonic_reachability', 'routing_candidate_budget_exceeded']) {
    assert.equal(safeError(new RoutingError(code, 503)), code);
  }
  assert.equal(safeError(new RoutingError('non_monotonic_isochrones', 503)), 'VALIDATION_ERROR');
  assert.equal(safeError(new RoutingError('private-origin-secret', 503)), 'VALIDATION_ERROR');
});

test('instrumentation preserves real provider malformed JSON classification and retry count', async () => {
  const outcome = async (wrapped: boolean) => {
    let calls = 0;
    const fetchImpl = async () => { calls++; return new Response('{ broken JSON'); };
    const measured = createMeasuredFetch({ appId: 'x', apiKey: 'y', hitsPerMinute: 100, fetchImpl });
    const provider = createTravelTimeProvider({ appId: 'x', apiKey: 'y', now: () => now, fetchImpl: wrapped ? measured.fetch : fetchImpl });
    let error: unknown;
    try { await provider.reachable({ origins: [{ id: 'p1', label: 'public', lat: 37.5, lng: 127 }], meetingAt: at }, [], 1800); } catch (caught) { error = caught; }
    assert.ok(error instanceof RoutingError);
    return { code: error.code, status: error.status, calls };
  };
  const direct = await outcome(false);
  assert.deepEqual(direct, { code: 'provider_invalid_response', status: 502, calls: 1 });
  assert.deepEqual(await outcome(true), direct);
});

test('bounded observation does not consume an oversized body ahead of the provider', async () => {
  let chunks = 0, cancelled = false;
  const measured = createMeasuredFetch({ appId: 'x', apiKey: 'y', hitsPerMinute: 100, fetchImpl: async () => new Response(new ReadableStream({
    pull(controller) { chunks++; controller.enqueue(new Uint8Array(1024 * 1024).fill(32)); if (chunks === 20) controller.close(); },
    cancel() { cancelled = true; },
  })) });
  const provider = createTravelTimeProvider({ appId: 'x', apiKey: 'y', now: () => now, fetchImpl: measured.fetch });
  await assert.rejects(() => provider.reachable({ origins: [{ id: 'p1', label: 'public', lat: 37.5, lng: 127 }], meetingAt: at }, [], 1800), e => e instanceof RoutingError && e.code === 'routing_response_too_large');
  assert.ok(chunks <= 11, `provider must stop near 8 MiB, read ${chunks} MiB`);
  assert.equal(cancelled, true);
  assert.equal(measured.metrics.requests, 1);
});

test('already aborted requests do not spend quota or start a network call', async () => {
  let calls = 0;
  const measured = createMeasuredFetch({ appId: 'x', apiKey: 'y', hitsPerMinute: 10, fetchImpl: async () => { calls++; return Response.json({ results: [] }); } });
  await assert.rejects(() => measured.fetch('https://api.traveltimeapp.com/v4/time-map', { body: JSON.stringify({ departure_searches: [{ id: 'a' }] }), signal: AbortSignal.abort() }));
  assert.equal(calls, 0);
  assert.equal(measured.metrics.requests, 0);
  assert.equal(measured.metrics.hits, 0);
});

test('aborting quota wait settles promptly and never sends the queued request', async () => {
  let calls = 0, beginWait!: () => void;
  const startedWaiting = new Promise<void>(resolve => { beginWait = resolve; });
  const measured = createMeasuredFetch({ appId: 'x', apiKey: 'y', hitsPerMinute: 10, sleep: async () => { beginWait(); return new Promise<void>(() => {}); }, fetchImpl: async () => { calls++; return Response.json({ results: [] }); } });
  const body = JSON.stringify({ arrival_searches: Array.from({ length: 10 }, (_, i) => ({ id: String(i), arrival_time: at })) });
  await measured.fetch('https://api.traveltimeapp.com/v4/time-filter', { body });
  const controller = new AbortController();
  const waiting = measured.fetch('https://api.traveltimeapp.com/v4/time-filter', { body, signal: controller.signal });
  await startedWaiting;
  controller.abort();
  const settled = waiting.then(() => 'resolved', () => 'rejected');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([settled, new Promise<string>(resolve => { timer = setTimeout(() => resolve('stalled'), 100); })]);
  clearTimeout(timer);
  assert.equal(result, 'rejected');
  assert.equal(calls, 1);
  assert.equal(measured.metrics.requests, 1);
  assert.equal(measured.metrics.hits, 10);
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
  const response = await measured.fetch('https://api.traveltimeapp.com/v4/time-filter', { body: JSON.stringify({ arrival_searches: [{ id: 'h', arrival_time: at }] }) });
  await response.json();
  assert.equal(measured.metrics.earlyArrivalSamples, 1);
  assert.equal(measured.metrics.travelTimeEqualsJourney, 1);
  assert.equal(measured.metrics.travelTimeEqualsBurden, 0);
  assert.equal(measured.metrics.mixedRoutes, 1);
  assert.doesNotMatch(JSON.stringify(measured.metrics), /private-origin|2026/);
});
