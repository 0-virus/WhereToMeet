import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Catalog, Hub, Recommendation, RecommendRequest } from '../src/shared.ts';
import type { ValidationAdapterFactory } from './validation/types.ts';
import { publicOrigins, scenarioDefinitions } from '../tests/fixtures/routing-scenarios.ts';

type Scenario = { id: string; intent: string; request: RecommendRequest };
type Snapshot = { seconds: number; reachable: Record<string, string[]> };
type Metrics = { requests: number; hits: number; quotaWaitMs: number; networkMs: number; routeSamples: number; earlyArrivalSamples: number; travelTimeEqualsJourney: number; travelTimeEqualsBurden: number; lateArrivalSamples: number; unknownModeParts: number; busParts: number; railParts: number; mixedRoutes: number };
type Measurement = { elapsedMs: number; serviceMs: number | null; metrics: Metrics };
type Comparison = { baselineRoutable: boolean; emptyAgreement: boolean; within180Seconds: boolean; differenceSeconds: number | null; unvalidatedRecommendations: number; bestHubMatches: boolean; topFourOverlap: number };
type ScenarioResult = { scenarioId: string; meetingAt?: string; status: 'MEASURED' | 'ERROR'; errorCode?: string; comparison?: Comparison; unsafeRecommendations?: number; monotonicityLosses?: number; isochrone?: Measurement; matrix?: Measurement; probes?: Measurement; intent: string };
const emptyMetrics = (): Metrics => ({ requests: 0, hits: 0, quotaWaitMs: 0, networkMs: 0, routeSamples: 0, earlyArrivalSamples: 0, travelTimeEqualsJourney: 0, travelTimeEqualsBurden: 0, lateArrivalSamples: 0, unknownModeParts: 0, busParts: 0, railParts: 0, mixedRoutes: 0 });
function fail(code: string): never { throw new Error(code); }
const normalizedName = (name: string) => name.replace(/\([^)]*\)/g, '').replace(/역$/, '').trim();
const rank = (a: Recommendation, b: Recommendation) => a.maxBurdenSeconds - b.maxBurdenSeconds || a.sumBurdenSeconds - b.sumBurdenSeconds || (a.hubId < b.hubId ? -1 : a.hubId > b.hubId ? 1 : 0);

export function selectHubs(hubs: Hub[], count = 100): Hub[] {
  if (!Number.isInteger(count) || count < 1) fail('CATALOG_SIZE_INVALID');
  if (!Array.isArray(hubs) || new Set(hubs.map(h => h.id)).size !== hubs.length || hubs.some(h => !h.id || !Number.isFinite(h.lat) || !Number.isFinite(h.lng) || h.lat < 36.8 || h.lat > 38.4 || h.lng < 124.5 || h.lng > 128)) fail('CATALOG_INVALID');
  if (hubs.length < count) fail('CATALOG_TOO_SMALL');
  const sorted = [...hubs].sort((a, b) => `${a.regionCode}:${a.kind}:${a.id}`.localeCompare(`${b.regionCode}:${b.kind}:${b.id}`, 'en'));
  return Array.from({ length: count }, (_, i) => sorted[Math.floor(i * sorted.length / count)]);
}

export function buildScenarios(hubs: Hub[], now: number): Scenario[] {
  return scenarioDefinitions.map(definition => {
    const origins = definition.origins.map((name, index) => {
      const found = publicOrigins[name] ?? [...hubs].sort((a, b) => a.id.localeCompare(b.id, 'en')).find(h => normalizedName(h.name) === normalizedName(name));
      if (!found) fail('SCENARIO_ORIGIN_MISSING');
      return { id: `p${index + 1}`, label: name, lat: found.lat, lng: found.lng };
    });
    const [hour, minute] = definition.time.split(':').map(Number);
    const kst = new Date(now + 9 * 3600000);
    let meeting = 0;
    for (let offset = 0; offset <= 7; offset++) {
      const candidate = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + offset, hour - 9, minute);
      const weekday = new Date(candidate + 9 * 3600000).getUTCDay();
      const weekend = weekday === 0 || weekday === 6;
      if (candidate > now + 4 * 3600000 && candidate <= now + 7 * 86400000 && (definition.day === 'any' || (definition.day === 'weekend') === weekend)) { meeting = candidate; break; }
    }
    if (!meeting) fail('SCENARIO_DATE_UNAVAILABLE');
    return { id: definition.id, intent: definition.intent, request: { origins, meetingAt: new Date(meeting).toISOString() } };
  });
}

export function validateRecommendations(results: Recommendation[], input: RecommendRequest, hubs: Hub[], now: number): number {
  const expected = new Set(input.origins.map(o => o.id));
  const meeting = Date.parse(input.meetingAt);
  const hubIds = new Set(hubs.map(h => h.id));
  const seen = new Set<string>();
  return results.filter((candidate, index) => {
    let invalid = !hubIds.has(candidate.hubId) || seen.has(candidate.hubId) || (index > 0 && rank(results[index - 1], candidate) > 0);
    seen.add(candidate.hubId);
    const routes = candidate.participantRoutes;
    if (!Array.isArray(routes) || routes.length !== expected.size || new Set(routes.map(r => r.originId)).size !== expected.size) return true;
    const burdens: number[] = [];
    for (const r of routes) {
      const departure = Date.parse(r.departureAt), arrival = Date.parse(r.arrivalAt);
      const burden = (meeting - departure) / 1000;
      burdens.push(burden);
      invalid ||= !expected.has(r.originId) || !Number.isFinite(departure) || !Number.isFinite(arrival) || departure < now || arrival < departure || arrival > meeting || !Number.isInteger(burden) || burden < 0 || r.burdenSeconds !== burden || r.travelSeconds !== (arrival - departure) / 1000 || r.earlyWaitSeconds !== (meeting - arrival) / 1000 || !Number.isInteger(r.transfers) || r.transfers < 0;
    }
    return invalid || candidate.maxBurdenSeconds !== Math.max(...burdens) || candidate.sumBurdenSeconds !== burdens.reduce((a, b) => a + b, 0);
  }).length;
}

export function compareResults(isochrone: Recommendation[], matrix: Recommendation[]): Comparison {
  const iso = [...isochrone].sort(rank), full = [...matrix].sort(rank);
  const baseline = new Map(full.map(r => [r.hubId, r]));
  const unvalidatedRecommendations = iso.filter(r => !baseline.has(r.hubId) || baseline.get(r.hubId)!.maxBurdenSeconds !== r.maxBurdenSeconds || baseline.get(r.hubId)!.sumBurdenSeconds !== r.sumBurdenSeconds).length;
  const differenceSeconds = iso[0] && full[0] ? iso[0].maxBurdenSeconds - full[0].maxBurdenSeconds : null;
  return { baselineRoutable: full.length > 0, emptyAgreement: !iso.length && !full.length, differenceSeconds, unvalidatedRecommendations, within180Seconds: unvalidatedRecommendations === 0 && differenceSeconds !== null && differenceSeconds >= 0 && differenceSeconds <= 180, bestHubMatches: !!iso[0] && !!full[0] && iso[0].hubId === full[0].hubId, topFourOverlap: iso.slice(0, 4).filter(r => full.slice(0, 4).some(f => f.hubId === r.hubId)).length };
}

export function monotonicityLosses(snapshots: Snapshot[]): number {
  const sorted = [...snapshots].sort((a, b) => a.seconds - b.seconds);
  let losses = 0;
  for (let index = 1; index < sorted.length; index++) {
    for (const [origin, ids] of Object.entries(sorted[index - 1].reachable)) {
      const next = new Set(sorted[index].reachable[origin] ?? []);
      losses += ids.filter(id => !next.has(id)).length;
    }
  }
  return losses;
}

export function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)];
}

export function summarize(results: ScenarioResult[], blockers: string[], catalogVerified: boolean) {
  const compared = results.filter(r => r.comparison);
  const routable = compared.filter(r => r.comparison!.baselineRoutable);
  const emptyAgreements = compared.filter(r => r.comparison!.emptyAgreement).length;
  const accuracy = routable.length ? routable.filter(r => r.comparison!.within180Seconds).length / routable.length : null;
  // Parallel work can overlap quota waits; subtracting them would hide real processing time.
  const latency = (measurements: Measurement[]) => measurements.flatMap(m => m.metrics.quotaWaitMs === 0 && m.serviceMs !== null ? [m.serviceMs] : []);
  const times = latency(results.flatMap(r => r.isochrone ? [r.isochrone] : []));
  const p50 = percentile(times, .5), p95 = percentile(times, .95);
  const unsafe = results.reduce((n, r) => n + (r.unsafeRecommendations ?? 0) + (r.comparison?.unvalidatedRecommendations ?? 0), 0);
  const losses = results.reduce((n, r) => n + (r.monotonicityLosses ?? 0), 0);
  const failures = unsafe > 0 || losses > 0 || (accuracy !== null && accuracy < .95) || (p50 !== null && p50 > 5000) || (p95 !== null && p95 > 10000) || times.some(t => t > 30000) || results.some(r => r.status === 'ERROR');
  const complete = results.length === 20 && times.length === 20 && compared.length === 20 && routable.length > 0 && results.every(r => r.probes) && catalogVerified && blockers.length === 0;
  const usage = (mode: 'isochrone' | 'matrix') => {
    const measurements = results.flatMap(r => r[mode] ? [r[mode]!] : []);
    const hits = measurements.map(m => m.metrics.hits);
    const times = latency(measurements);
    return { samples: hits.length, latencySamples: times.length, averageHits: hits.length ? hits.reduce((a, b) => a + b, 0) / hits.length : null, maxHits: hits.length ? Math.max(...hits) : null, totalRequests: measurements.reduce((n, m) => n + m.metrics.requests, 0), totalQuotaWaitMs: measurements.reduce((n, m) => n + m.metrics.quotaWaitMs, 0), p50ServiceMs: percentile(times, .5), p95ServiceMs: percentile(times, .95) };
  };
  return { status: failures ? 'FAIL' : complete ? 'PASS' : 'BLOCKED', completedScenarios: results.filter(r => r.status === 'MEASURED').length, comparedScenarios: compared.length, baselineRoutableScenarios: routable.length, emptyAgreements, within180SecondsRate: accuracy, unsafeRecommendations: unsafe, monotonicityLosses: losses, p50ServiceMs: p50, p95ServiceMs: p95, over30Seconds: times.filter(t => t > 30000).length, latencyExcludesQuotaWaiting: true, isochrone: usage('isochrone'), matrix: usage('matrix') };
}

function observeRoutes(body: unknown, requested: Record<string, number>, metrics: Metrics) {
  if (!body || typeof body !== 'object' || !('results' in body) || !Array.isArray(body.results)) return;
  for (const result of body.results) {
    if (!Array.isArray(result?.locations)) continue;
    for (const location of result.locations) for (const properties of location.properties ?? []) {
      const route = properties.route;
      if (!route) continue;
      const start = Date.parse(route.departure_time), end = Date.parse(route.arrival_time), meeting = requested[result.search_id];
      if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(meeting)) continue;
      metrics.routeSamples++;
      if (end < meeting) metrics.earlyArrivalSamples++;
      if (end > meeting) metrics.lateArrivalSamples++;
      if (properties.travel_time === (end - start) / 1000) metrics.travelTimeEqualsJourney++;
      if (properties.travel_time === (meeting - start) / 1000) metrics.travelTimeEqualsBurden++;
      let bus = false, rail = false;
      for (const part of route.parts ?? []) {
        if (part.mode === 'bus') { metrics.busParts++; bus = true; }
        else if (['rail_underground', 'rail_overground'].includes(part.mode)) { metrics.railParts++; rail = true; }
        else if (!['walk', 'walking', 'wait'].includes(part.mode)) metrics.unknownModeParts++;
      }
      if (bus && rail) metrics.mixedRoutes++;
    }
  }
}

// Observe only the bytes the production parser pulls, up to its 8 MiB limit.
// Observation never turns malformed input or cancellation into a fetch failure.
function observeResponse(response: Response, requested: Record<string, number>, metrics: Metrics): Response {
  const maxBytes = 8 * 1024 * 1024;
  if (!response.body || Number(response.headers.get('content-length')) > maxBytes) return response;
  const decoder = new TextDecoder();
  let size = 0, text = '';
  const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size <= maxBytes) text += decoder.decode(chunk, { stream: true });
      else text = '';
      controller.enqueue(chunk);
    },
    flush() {
      if (size > maxBytes) return;
      try { observeRoutes(JSON.parse(text + decoder.decode()), requested, metrics); } catch { /* The production parser owns response errors. */ }
      text = '';
    },
  }));
  return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
}

function quotaWait(ms: number, signal: AbortSignal | undefined, sleep?: (ms: number) => Promise<void>): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const abort = () => { clean(); reject(signal!.reason); };
    const finish = () => { clean(); resolve(); };
    signal?.addEventListener('abort', abort, { once: true });
    if (sleep) Promise.resolve().then(() => sleep(ms)).then(finish, error => { clean(); reject(error); });
    else timer = setTimeout(finish, ms);
  });
}

type RequestDiagnostic = { at: string; endpoint: string; hits: number; rollingHits: number; status?: number; scenarioId?: string; searches: { seconds?: number; time?: string; transportation?: string; walkingSeconds?: number }[] };
type ErrorDiagnostic = { requestIndex: number; status: number; bodyStatus: string; providerErrorCode?: number; description?: unknown; additionalInfo?: unknown };

async function diagnoseError(response: Response, request: unknown, secrets: string[]): Promise<Omit<ErrorDiagnostic, 'requestIndex' | 'status'>> {
  const reader = response.body?.getReader();
  if (!reader) return { bodyStatus: 'EMPTY' };
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) { await reader.cancel(); return { bodyStatus: 'TOO_LARGE' }; }
      chunks.push(value);
    }
    const error = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    // Provider messages may echo input. Remove all request strings and coordinates, including echoes in prose.
    const sensitive = new Set(secrets.filter(Boolean));
    const collect = (value: unknown, coordinate = false): void => {
      if (typeof value === 'string' || (coordinate && typeof value === 'number')) sensitive.add(String(value));
      else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) collect(child, coordinate || ['coords', 'lat', 'lng'].includes(key));
    };
    collect(request);
    const scrub = (value: unknown, depth = 0): unknown => {
      if (depth > 5) return '[TRUNCATED]';
      if (typeof value === 'string') {
        for (const secret of [...sensitive].sort((a,b) => b.length-a.length)) value = (value as string).split(secret).join('[REDACTED]');
        return (value as string).replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+|[-+]?\d+\.\d+/g, '[REDACTED]').slice(0, 1000);
      }
      if (Array.isArray(value)) return value.slice(0, 30).map(v => scrub(v, depth + 1));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, child]) => [String(scrub(key)), /coords|latitude|longitude|lat$|lng$|key|token|authorization|header|address|label/i.test(key) ? '[REDACTED]' : scrub(child, depth + 1)]));
      return typeof value === 'number' ? '[NUMBER]' : value;
    };
    return { bodyStatus: 'JSON', ...(Number.isInteger(error?.error_code) ? { providerErrorCode: error.error_code } : {}), description: scrub(error?.description), additionalInfo: scrub(error?.additional_info) };
  } catch { void reader.cancel().catch(() => {}); return { bodyStatus: 'UNREADABLE' }; }
}

export function createMeasuredFetch(options: { appId: string; apiKey: string; hitsPerMinute: number; stopOnHttpError?: boolean; fetchImpl?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void> }) {
  const metrics = emptyMetrics();
  const diagnostics: { requests: RequestDiagnostic[]; providerErrors: ErrorDiagnostic[] } = { requests: [], providerErrors: [] };
  const now = options.now ?? Date.now;
  const implementation = options.fetchImpl ?? fetch;
  let recent: { at: number; hits: number }[] = [];
  let waiting = 0, waitStarted = 0;
  const measured: typeof fetch = async (input, init) => {
    if (options.stopOnHttpError && diagnostics.providerErrors.length) fail(`PROVIDER_HTTP_${diagnostics.providerErrors[0].status}`);
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    signal?.throwIfAborted();
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== 'https://api.traveltimeapp.com' || !['/v4/time-map', '/v4/time-filter'].includes(url.pathname) || url.search) fail('PROVIDER_ENDPOINT_REJECTED');
    let body: Record<string, any>;
    try { body = JSON.parse(String(init?.body ?? '{}')); } catch { fail('PROVIDER_REQUEST_INVALID'); }
    const searches = [...(body.departure_searches ?? []), ...(body.arrival_searches ?? [])];
    const hits = searches.length;
    if (hits < 1 || hits > 10 || hits > options.hitsPerMinute) fail('PROVIDER_HIT_BUDGET_INVALID');
    recent = recent.filter(entry => entry.at > now() - 60000);
    while (recent.reduce((sum, entry) => sum + entry.hits, 0) + hits > options.hitsPerMinute) {
      const wait = Math.max(1, recent[0].at + 60001 - now());
      if (waiting++ === 0) waitStarted = now();
      try { await quotaWait(wait, signal ?? undefined, options.sleep); }
      finally { if (--waiting === 0) metrics.quotaWaitMs += now() - waitStarted; }
      signal?.throwIfAborted();
      recent = recent.filter(entry => entry.at > now() - 60000);
    }
    signal?.throwIfAborted();
    if (options.stopOnHttpError && diagnostics.providerErrors.length) fail(`PROVIDER_HTTP_${diagnostics.providerErrors[0].status}`);
    recent.push({ at: now(), hits });
    const diagnostic: RequestDiagnostic = { at: new Date(now()).toISOString(), endpoint: url.pathname, hits, rollingHits: recent.reduce((sum, entry) => sum + entry.hits, 0), searches: searches.map(s => ({ seconds: s.travel_time, time: s.departure_time ?? s.arrival_time, transportation: s.transportation?.type, walkingSeconds: s.transportation?.walking_time })) };
    const requestIndex = diagnostics.requests.length;
    if (options.stopOnHttpError) diagnostics.requests.push(diagnostic);
    metrics.requests++; metrics.hits += hits;
    const start = now();
    try {
      const response = await implementation(input, { ...init, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
      diagnostic.status = response.status;
      if (!response.ok && options.stopOnHttpError) {
        const failure: ErrorDiagnostic = { requestIndex, status: response.status, bodyStatus: 'PENDING' };
        diagnostics.providerErrors.push(failure);
        Object.assign(failure, await diagnoseError(response, body, [options.appId, options.apiKey]));
        // This diagnostic run stops on refusal; do not wait for Retry-After or permit another network call.
        return new Response(null, { status: response.status });
      }
      // Preserve the production adapter's normal retry policy outside diagnostic runs.
      if (!response.ok) return response;
      const requested = Object.fromEntries((body.arrival_searches ?? []).map((s: { id: string; arrival_time: string }) => [s.id, Date.parse(s.arrival_time)]));
      return observeResponse(response, requested, metrics);
    } catch (error) {
      if (error instanceof Error && /^PROVIDER_[A-Z_0-9]+$/.test(error.message)) throw error;
      fail(error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'PROVIDER_TIMEOUT' : 'PROVIDER_NETWORK_ERROR');
    } finally { metrics.networkMs += now() - start; }
  };
  return { fetch: measured, metrics, diagnostics };
}

export function safeError(error: unknown): string {
  const routingCodes = ['provider_rejected', 'provider_rate_limited', 'provider_unavailable', 'provider_invalid_response', 'provider_not_configured', 'routing_timeout', 'routing_budget_exceeded', 'routing_response_too_large', 'quota_unavailable', 'cancelled', 'non_monotonic_reachability', 'routing_candidate_budget_exceeded', 'departure_in_past', 'invalid_validation_deadline', 'invalid_routing_budget', 'invalid_travel_limit', 'invalid_candidate_budget', 'invalid_routing_input'];
  if (error instanceof Error && 'code' in error && typeof error.code === 'string' && routingCodes.includes(error.code)) return error.code;
  const known = ['CATALOG_INVALID', 'CATALOG_TOO_SMALL', 'CATALOG_SIZE_INVALID', 'SCENARIO_ORIGIN_MISSING', 'SCENARIO_DATE_UNAVAILABLE', 'SCENARIO_EXPIRED', 'REACHABILITY_RESPONSE_INVALID', 'MODE_INVALID', 'PROVIDER_ENDPOINT_REJECTED', 'PROVIDER_REQUEST_INVALID', 'PROVIDER_HIT_BUDGET_INVALID', 'PROVIDER_RESPONSE_INVALID', 'PROVIDER_TIMEOUT', 'PROVIDER_NETWORK_ERROR'];
  return error instanceof Error && (known.includes(error.message) || /^PROVIDER_HTTP_[1-5][0-9]{2}$/.test(error.message)) ? error.message : 'VALIDATION_ERROR';
}

async function main() {
  const { values } = parseArgs({ options: {
    mode: { type: 'string', default: 'compare' }, catalog: { type: 'string', default: 'data/hubs.sample.json' }, adapter: { type: 'string', default: 'server/validation-adapter.ts' }, out: { type: 'string' }, 'catalog-size': { type: 'string', default: '100' }, 'hits-per-minute': { type: 'string' }, 'preflight-only': { type: 'boolean', default: false },
  } });
  if (!['compare', 'isochrone', 'matrix'].includes(values.mode!)) fail('MODE_INVALID');
  const blockers: string[] = [];
  const results: ScenarioResult[] = [];
  let totalUsage = emptyMetrics();
  let diagnostics: ReturnType<typeof createMeasuredFetch>['diagnostics'] = { requests: [], providerErrors: [] };
  const scheduleReferenceAt = new Date().toISOString();
  let catalog: Catalog | undefined, hubs: Hub[] = [], scenarios: Scenario[] = [];
  try { catalog = JSON.parse(await readFile(resolve(values.catalog!), 'utf8')); hubs = selectHubs(catalog!.hubs, values['catalog-size'] === 'all' ? catalog!.hubs.length : Number(values['catalog-size'])); if (hubs.length < 100) fail('CATALOG_TOO_SMALL'); }
  catch (error) { blockers.push(safeError(error) === 'VALIDATION_ERROR' ? 'CATALOG_UNAVAILABLE' : safeError(error)); }
  try { scenarios = buildScenarios(catalog?.hubs ?? [], Date.parse(scheduleReferenceAt)); } catch (error) { blockers.push(safeError(error)); }
  const catalogVerified = hubs.length >= 100 && hubs.every(h => h.verified);
  if (!catalogVerified) blockers.push('CATALOG_FIELD_REVIEW_REQUIRED');
  const appId = process.env.TRAVELTIME_APP_ID, apiKey = process.env.TRAVELTIME_API_KEY;
  if (!appId || !apiKey) blockers.push('TRAVELTIME_CREDENTIALS_MISSING');
  const hitsPerMinute = Number(values['hits-per-minute'] ?? process.env.TRAVELTIME_HITS_PER_MINUTE);
  if (!Number.isInteger(hitsPerMinute) || hitsPerMinute < 10) blockers.push('CONFIRMED_HIT_LIMIT_REQUIRED');
  if (values.mode !== 'compare') blockers.push('COMPARISON_NOT_REQUESTED');
  // These human/external checks are deliberately never inferred from mock responses.
  blockers.push('BUS_RAIL_MIXED_TEN_CASES_EACH_REQUIRE_REVIEW', 'TEN_REAL_USER_JOURNEYS_REQUIRED', 'TRANSPORT_SCOPE_AND_SUPPLIER_SEMANTICS_REQUIRE_REVIEW');
  if (values['preflight-only']) blockers.push('LIVE_RUN_NOT_REQUESTED');
  let factory: ValidationAdapterFactory | undefined;
  if (appId && apiKey && hubs.length >= 100 && scenarios.length === 20 && Number.isInteger(hitsPerMinute) && hitsPerMinute >= 10 && !values['preflight-only']) {
    try { factory = (await import(pathToFileURL(resolve(values.adapter!)).href)).createRoutingValidationAdapter; if (typeof factory !== 'function') fail('ENGINE_ADAPTER_UNAVAILABLE'); }
    catch { blockers.push('ENGINE_ADAPTER_UNAVAILABLE'); }
  }
  if (factory) {
    const measured = createMeasuredFetch({ appId: appId!, apiKey: apiKey!, hitsPerMinute, stopOnHttpError: true });
    diagnostics = measured.diagnostics;
    totalUsage = measured.metrics;
    const adapter = factory({ appId: appId!, apiKey: apiKey!, fetchImpl: measured.fetch, now: Date.now, validationDeadlineMs: 24 * 3600000 });
    const measure = async <T>(operation: () => Promise<T>): Promise<{ value: T; measurement: Measurement }> => {
      const before = { ...measured.metrics }, start = Date.now();
      const value = await operation();
      const delta = Object.fromEntries(Object.entries(measured.metrics).map(([key, number]) => [key, number - before[key as keyof Metrics]])) as Metrics;
      const elapsedMs = Date.now() - start;
      return { value, measurement: { elapsedMs, serviceMs: delta.quotaWaitMs === 0 ? elapsedMs : null, metrics: delta } };
    };
    for (const scenario of scenarios) {
      const firstRequest = diagnostics.requests.length;
      const result: ScenarioResult = { scenarioId: scenario.id, meetingAt: scenario.request.meetingAt, intent: scenario.intent, status: 'MEASURED' };
      try {
        if (Date.parse(scenario.request.meetingAt) <= Date.now()) fail('SCENARIO_EXPIRED');
        let iso: Recommendation[] | undefined, full: Recommendation[] | undefined;
        if (values.mode !== 'matrix') { const run = await measure(() => adapter.recommend(scenario.request, hubs)); iso = run.value; result.isochrone = run.measurement; result.unsafeRecommendations = validateRecommendations(iso, scenario.request, hubs, Date.now()) + (iso.length > 4 ? 1 : 0); }
        if (values.mode !== 'isochrone') { const run = await measure(() => adapter.matrix(scenario.request, hubs)); full = run.value; result.matrix = run.measurement; result.unsafeRecommendations = (result.unsafeRecommendations ?? 0) + validateRecommendations(full, scenario.request, hubs, Date.now()); }
        if (iso && full) result.comparison = compareResults(iso, full);
        if (values.mode !== 'matrix') {
          const run = await measure(async () => {
            const snapshots: Snapshot[] = [];
            for (const seconds of [900, 1800, 2700, 3600, 7200, 14400]) {
              if (Date.parse(scenario.request.meetingAt) - seconds * 1000 < Date.now()) fail('SCENARIO_EXPIRED');
              const reachable = await adapter.reachable(scenario.request, hubs, seconds);
              const ids = new Set(hubs.map(h => h.id));
              if (scenario.request.origins.some(o => !Array.isArray(reachable[o.id]) || reachable[o.id].some(id => !ids.has(id)))) fail('REACHABILITY_RESPONSE_INVALID');
              snapshots.push({ seconds, reachable });
            }
            return monotonicityLosses(snapshots);
          });
          result.probes = run.measurement; result.monotonicityLosses = run.value;
        }
      } catch (error) { result.status = 'ERROR'; result.errorCode = safeError(error); }
      for (const request of diagnostics.requests.slice(firstRequest)) request.scenarioId = scenario.id;
      results.push(result);
      // Progress contains only fixed scenario IDs, never provider bodies or coordinates.
      process.stderr.write(`${scenario.id}: ${result.status}${result.errorCode ? ` (${result.errorCode})` : ''}\n`);
      if (diagnostics.providerErrors.length) { blockers.push('PROVIDER_HTTP_REFUSAL'); break; }
      if (result.errorCode && (/PROVIDER_HTTP_(401|403|429)/.test(result.errorCode) || ['provider_rejected', 'provider_rate_limited', 'provider_not_configured', 'quota_unavailable'].includes(result.errorCode))) { blockers.push('PROVIDER_ACCESS_OR_QUOTA_BLOCKED'); break; }
    }
  }
  if (results.length && !totalUsage.requests) blockers.push('NO_PROVIDER_REQUESTS_OBSERVED');
  if (results.length && !totalUsage.routeSamples) blockers.push('ROUTE_TIMESTAMP_EVIDENCE_MISSING');
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), scheduleReferenceAt, evidence: totalUsage.requests ? 'LIVE_API_ATTEMPT' : 'NO_LIVE_API_EVIDENCE', mode: values.mode, configuredHitsPerMinute: hitsPerMinute, catalog: { version: catalog?.version ?? null, totalHubs: catalog?.hubs.length ?? 0, testedHubs: hubs.length, verifiedHubs: hubs.filter(h => h.verified).length }, plannedScenarios: 20, blockers, totalUsage, diagnostics, summary: summarize(results, blockers, catalogVerified), results };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (values.out) { const filename = resolve(values.out); await mkdir(dirname(filename), { recursive: true }); await writeFile(filename, output); }
  process.stdout.write(output);
  process.exitCode = report.summary.status === 'PASS' ? 0 : report.summary.status === 'FAIL' ? 1 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${safeError(error)}\n`); process.exitCode = 2; });
}
