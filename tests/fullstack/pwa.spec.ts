import { test, expect } from '@playwright/test';

test('installed static shell opens offline and never caches history or provider APIs', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.getByRole('button', { name: '내 기록', exact: true }).click();
  await expect(page.getByRole('heading', { name: '다음 만남을 위한 작은 기록' })).toBeVisible();
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) urls.push(request.url);
    return urls;
  });
  expect(cached.some(url => url.endsWith('/index.html'))).toBe(true);
  expect(cached.some(url => url.includes('/assets/'))).toBe(true);
  expect(cached.some(url => url.includes('/api/') || !url.startsWith('http://127.0.0.1:4181/') || new URL(url).search)).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /어디서 만날까요/ })).toBeVisible();
  await expect(page.getByText('인터넷에 연결되어 있지 않아요. 연결 후 다시 검색해 주세요.')).toBeVisible();
  await expect(page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true })).toBeDisabled();
  await context.setOffline(false);
});
