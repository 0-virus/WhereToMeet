// The production build replaces this configuration with exact, content-versioned static files.
const SHELL = /* PWA_CONFIG_START */ { version: 'development', files: ['/offline.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png'] } /* PWA_CONFIG_END */;
const CACHE_PREFIX = 'wheretomeet-shell-';
const CACHE_NAME = CACHE_PREFIX + SHELL.version;
const staticPaths = new Set(SHELL.files);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // No runtime writes: only explicit static build artifacts can ever enter this cache.
    for (const path of SHELL.files) {
      const request = new Request(new URL(path, self.location.origin), { credentials: 'omit', cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok || response.redirected || response.type === 'opaque' || /private|no-store/i.test(response.headers.get('cache-control') || '') || response.headers.has('set-cookie')) {
        throw new Error('Refusing to cache a non-static or private response');
      }
      await cache.put(path, response);
    }
  })());
  // Do not force an update into open forms/searches. Activate after all old tabs close.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  // Navigation responses may be personalized: use the network but NEVER cache them.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match('/index.html') || await cache.match('/offline.html') || new Response('인터넷 연결을 확인해 주세요.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }
  if (url.search || !staticPaths.has(url.pathname) || request.headers.has('authorization')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(url.pathname) || fetch(request);
  })());
});
