// Test-only HTTP host: real Worker routes + SQL, deterministic external providers.
// This file is never imported by the production Worker or browser bundle.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createWorker } from '../../server/app.ts';
import { rankCandidates } from '../../server/recommend.ts';
import { testDb } from '../d1-test-helper.ts';
import type { Catalog, RecommendRequest } from '../../src/shared.ts';

const port = 4181;
const { db } = testDb();
const catalog: Catalog = { version: 'fullstack-test', generatedAt: new Date().toISOString(), hubs: Array.from({ length: 4 }, (_, i) => ({ id: `test-hub-${i}`, name: ['사당역', '서울역', '왕십리역', '강남역'][i], lat: 37.5 + i * .01, lng: 127, regionCode: '11', kind: 'rail', sourceId: String(i), sourceUrl: 'https://data.seoul.go.kr/', sourceDate: '2026-10-05', verified: true })) };
const fixtureFetch: typeof fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.pathname.endsWith('/coord2regioncode.json')) return Response.json({ documents: [{ region_type: 'H', code: '1114052000', region_1depth_name: '서울특별시', region_2depth_name: '중구' }, { region_type: 'B', code: '1114012000', region_1depth_name: '서울특별시', region_2depth_name: '중구' }] });
  if (url.hostname === 'dapi.kakao.com') return Response.json({ documents: [{ id: '100', place_name: '서울역', x: '126.972135', y: '37.556228', address_name: '서울 중구 한강대로', road_address_name: '서울 중구 한강대로', category_group_name: '교통', place_url: 'https://place.map.kakao.com/100', distance: '120' }], meta: { is_end: true } });
  throw new Error('Unexpected external fixture request');
};
const worker = createWorker({ catalog, fetchImpl: fixtureFetch, recommendImpl: async (request: RecommendRequest, hubs) => rankCandidates(hubs.map((hub, i) => ({ hubId: hub.id, routes: request.origins.map(origin => ({ originId: origin.id, departureAt: new Date(Date.parse(request.meetingAt) - (1800 + i * 60) * 1000).toISOString(), arrivalAt: new Date(Date.parse(request.meetingAt) - 300000).toISOString(), transfers: i % 2 })) })), request.origins.map(o => o.id), request.meetingAt, new Date().toISOString()) });
const env = { DB: db, ROUTING_APPROVED: 'true', TRAVELTIME_APP_ID: 'test', TRAVELTIME_API_KEY: 'test', KAKAO_REST_API_KEY: 'test', TRAVELTIME_HITS_PER_MINUTE: '100000', TRAVELTIME_HITS_PER_SEARCH: '120', MAX_CONCURRENT_SEARCHES: '10', ENVIRONMENT: 'test' };
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const headers = new Headers(); for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      const body = Buffer.concat(chunks);
      const request = new Request(url, { method: req.method, headers, body: body.length ? body.toString('utf8') : undefined });
      const pending: Promise<unknown>[] = [];
      const response = await worker.fetch(request, env as never, { waitUntil: (p: Promise<unknown>) => { pending.push(p); } } as ExecutionContext);
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
      await Promise.allSettled(pending); return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filename = resolve('dist', relative || 'index.html');
    if (!filename.startsWith(resolve('dist') + '/') && !filename.startsWith(resolve('dist') + '\\')) { res.writeHead(404); res.end(); return; }
    let bytes: Buffer, served = filename;
    try { bytes = await readFile(filename); } catch { served = resolve('dist/index.html'); bytes = await readFile(served); }
    res.writeHead(200, { 'Content-Type': mime[extname(served)] ?? 'application/octet-stream' }); res.end(bytes);
  } catch (error) { console.error(error instanceof Error ? error.name : 'TEST_SERVER_ERROR'); res.writeHead(500); res.end('Test host error'); }
}).listen(port, '127.0.0.1', () => console.log(`Full-stack test host on ${port}`));
