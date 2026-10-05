import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const origin = 'https://meet.operator.kr';
const valid = { APP_ORIGIN: origin, ANDROID_PACKAGE_ID: 'kr.operator.meet', PLAY_APP_SIGNING_SHA256: Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join(':') };

test('Android identity rejects insecure, private, path-bearing and ambiguous origins, invalid packages and certificates', async () => {
  const { androidIdentity } = await import('../scripts/android-config.mjs');
  const identity = androidIdentity(valid);
  assert.equal(identity.origin, origin);
  assert.equal(identity.assetlinks[0].target.package_name, 'kr.operator.meet');
  assert.equal(identity.assetlinks[0].target.sha256_cert_fingerprints[0], valid.PLAY_APP_SIGNING_SHA256.toUpperCase());
  for (const url of ['http://meet.operator.kr', 'https://localhost', 'https://127.0.0.1', 'https://192.168.1.2', 'https://meet.operator.kr/path', 'https://meet.operator.kr/..', 'https://user:pass@meet.operator.kr', 'https://meet.operator.kr?key=secret', 'https://example.com', 'https://meet.operator.kr:8443']) {
    assert.throws(() => androidIdentity({ ...valid, APP_ORIGIN: url }), undefined, url);
  }
  for (const value of ['', 'com.example.app', 'meeting', 'kr.operator.my-app']) assert.throws(() => androidIdentity({ ...valid, ANDROID_PACKAGE_ID: value }));
  for (const value of ['', 'AA:BB', 'GG:'.repeat(31) + 'GG', '00:'.repeat(31) + '00']) assert.throws(() => androidIdentity({ ...valid, PLAY_APP_SIGNING_SHA256: value }));
});

async function swHarness(fetchResponse = new Response('online')) {
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const listeners = new Map();
  const cached = new Map();
  const deleted = [];
  const fetches = [];
  const cache = { put: async (key, value) => cached.set(typeof key === 'string' ? key : key.url, value), match: async (key) => cached.get(typeof key === 'string' ? key : key.url) };
  vm.runInNewContext(source, {
    URL, Request, Response,
    self: { location: { origin }, addEventListener: (name, handler) => listeners.set(name, handler), clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => ['other-app', 'wheretomeet-shell-old'], delete: async (name) => deleted.push(name) },
    fetch: async (request) => { fetches.push(request); if (fetchResponse instanceof Error) throw fetchResponse; return fetchResponse.clone(); },
  });
  const dispatch = async (type, request) => { let response; let done; listeners.get(type)({ request, respondWith: (value) => { response = value; }, waitUntil: (value) => { done = value; } }); await done; return response ? await response : undefined; };
  return { dispatch, cached, deleted, fetches };
}

test('SW bypasses APIs, map/remote URLs, private paths, query-bearing assets and mutations', async () => {
  const sw = await swHarness();
  for (const [url, method] of [
    ['/api/history', 'GET'], ['/api/recommend', 'POST'], ['/private.json', 'GET'], ['/manifest.webmanifest?token=secret', 'GET'], ['https://map.kakao.com/map.js', 'GET'], ['/offline.html', 'POST'],
  ]) assert.equal(await sw.dispatch('fetch', new Request(new URL(url, origin), { method })), undefined, url);
  assert.equal(sw.cached.size, 0);
  assert.equal(sw.fetches.length, 0);
});

test('SW serves offline navigation without storing a user-specific URL and only clears its own caches', async () => {
  const sw = await swHarness(new Error('offline'));
  sw.cached.set('/offline.html', new Response('offline shell'));
  const response = await sw.dispatch('fetch', { url: origin + '/?hub=public-hub', method: 'GET', mode: 'navigate' });
  assert.equal(await response.text(), 'offline shell');
  assert.deepEqual([...sw.cached.keys()], ['/offline.html']);
  await sw.dispatch('activate');
  assert.deepEqual(sw.deleted, ['wheretomeet-shell-old']);
});

test('SW install refuses private/no-store responses and always omits cookies', async () => {
  const sw = await swHarness(new Response('private', { headers: { 'cache-control': 'private, no-store' } }));
  await assert.rejects(() => sw.dispatch('install'), /cache|static|private/i);
  assert.equal(sw.cached.size, 0);
  assert.equal(sw.fetches[0].credentials, 'omit');
});

test('PWA build includes content-hashed shell assets and changes cache version after a build changes', async () => {
  const { buildPwa } = await import('../scripts/build-pwa.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'wtm-pwa-'));
  try {
    await mkdir(join(dir, 'assets'));
    await writeFile(join(dir, 'index.html'), '<script src="/assets/main-a.js"></script>');
    await writeFile(join(dir, 'assets/main-a.js'), 'first');
    await writeFile(join(dir, 'sw.js'), await readFile(new URL('../public/sw.js', import.meta.url)));
    await writeFile(join(dir, 'offline.html'), 'offline');
    const first = await buildPwa(dir);
    assert.ok(first.files.includes('/assets/main-a.js'));
    assert.ok(first.files.includes('/index.html'));
    assert.ok(!first.files.includes('/sw.js'));
    await writeFile(join(dir, 'assets/main-a.js'), 'second');
    const second = await buildPwa(dir);
    assert.notEqual(first.version, second.version);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('release gate blocks empty catalog, missing routing approval, identity, contact and APK/AAB artifacts', async () => {
  const { releaseProblems } = await import('../scripts/check-release.mjs');
  const root = await mkdtemp(join(tmpdir(), 'wtm-release-'));
  try {
    await mkdir(join(root, 'data'));
    await writeFile(join(root, 'data/hubs.json'), JSON.stringify({ hubs: [] }));
    await writeFile(join(root, 'data/quality-report.json'), JSON.stringify({ verifiedCount: 0 }));
    const issues = await releaseProblems({}, root);
    for (const expected of ['catalog', 'ROUTING_APPROVED', 'APP_ORIGIN', 'ANDROID_PACKAGE_ID', 'PLAY_APP_SIGNING_SHA256', 'VITE_OPERATOR_CONTACT', '.aab', '.apk']) assert.ok(issues.some((issue) => issue.includes(expected)), expected);
    await writeFile(join(root, 'data/hubs.json'), JSON.stringify({ hubs: [{ verified: false, regionCode: 'unreviewed' }] }));
    await writeFile(join(root, 'data/quality-report.json'), JSON.stringify({ verifiedCount: 1 }));
    const unreviewed = await releaseProblems(valid, root);
    assert.ok(unreviewed.some((issue) => issue.includes('unverified')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('manifest points to real installable PNG sizes including a separate maskable asset', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const png = await readFile(new URL('../public' + icon.src, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  }
});
