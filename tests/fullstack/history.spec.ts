import { test, expect } from '@playwright/test';

test('browser → Worker → SQL: recommendation, bookmark, reload, ownership and deletion', async ({ page, browser }) => {
  await page.goto('/');
  for (const index of [0, 1]) {
    await page.getByRole('combobox').nth(index).fill('서울');
    await page.getByRole('option', { name: /서울역/ }).click();
  }
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/recommendations'));
  await page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.historySaved).toBe(true);
  expect(result.recommendations).toHaveLength(4);
  await expect(page.getByRole('heading', { name: '우리에게 편한 만날 곳 4곳' })).toBeVisible();
  await page.getByRole('button', { name: '사당역 즐겨찾기', exact: true }).click();
  await expect(page.getByRole('button', { name: '사당역 즐겨찾기 해제', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByRole('button', { name: '내 기록', exact: true }).click();
  await expect(page.getByRole('link', { name: /사당역/ })).toBeVisible();

  const other = await browser.newContext();
  const denied = await other.request.get(`http://127.0.0.1:4181/api/history/${result.historyId}`);
  expect(denied.status()).toBe(404);
  await other.close();

  const recomputed = page.waitForResponse(response => response.url().endsWith('/api/recommendations'));
  await page.getByRole('button', { name: '다시 검색', exact: true }).click();
  expect((await (await recomputed).json()).historyId).toBe(result.historyId);
  await expect(page.getByRole('button', { name: '사당역 즐겨찾기 해제', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '내 기록', exact: true }).click();
  await page.getByRole('button', { name: '전체 삭제', exact: true }).click();
  await page.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '다음 만남을 위한 작은 기록' })).toBeVisible();
  const after = await page.request.get(`/api/history/${result.historyId}`);
  expect(after.status()).toBe(404);
});
