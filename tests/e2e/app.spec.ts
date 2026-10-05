import { test, expect, type Page } from '@playwright/test';
const hub = { id: 'hub-1', name: '사당역', lat: 37.4765, lng: 126.9816, regionCode: '11', kind: 'rail', sourceId: '1', sourceUrl: 'https://data.seoul.go.kr', sourceDate: '2026-10-01', verified: true };
const places = [{ id: '1', name: '서울역', lat: 37.55, lng: 126.97, address: '서울 중구', url: 'https://place.map.kakao.com/1' }];
const origins = [{ id: 'person-1', label: '서울역', lat: 37.55, lng: 126.97 }, { id: 'person-2', label: '서울역', lat: 37.55, lng: 126.97 }];
const future = () => new Date(Date.now() + 24 * 3600000).toISOString();
const history = () => ({ id: 'history-1', origins, meetingAt: future(), searchedAt: new Date().toISOString(), bookmarkedHubIds: [] });

test('late bookmark response from an older search cannot replace the new record bookmarks', async ({ page }) => {
    await mock(page);
    let searchCount = 0;
    let releaseOldSave!: () => void;
    const oldSaveGate = new Promise<void>(resolve => { releaseOldSave = resolve; });
    await page.route('**/api/recommendations', route => {
        searchCount++;
        const body = route.request().postDataJSON();
        return route.fulfill({ json: {
            status: 'success', historyId: `history-${searchCount}`, historySaved: true,
            requestId: `request-${searchCount}`, calculatedAt: new Date().toISOString(), dataVersion: 'test',
            recommendations: [{ hubId: hub.id, hub, maxBurdenSeconds: 1800, sumBurdenSeconds: 3600,
                participantRoutes: body.origins.map((origin: { id: string }) => ({ originId: origin.id,
                    departureAt: new Date(Date.parse(body.meetingAt) - 1800000).toISOString(), arrivalAt: body.meetingAt,
                    travelSeconds: 1800, earlyWaitSeconds: 0, burdenSeconds: 1800, transfers: 0 })) }],
        } });
    });
    await page.route('**/api/history/history-2', route => route.fulfill({ json: { record: { ...history(), id: 'history-2', bookmarkedHubIds: ['keep-from-second-record'] } } }));
    await page.route('**/api/history/history-1/bookmarks', async route => {
        await oldSaveGate;
        await route.fulfill({ json: { record: { ...history(), bookmarkedHubIds: [hub.id] } } });
    });
    await page.goto('/'); await selectOrigins(page);
    const submit = page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true });
    await submit.click();
    const oldSaveStarted = page.waitForRequest('**/api/history/history-1/bookmarks');
    await page.getByRole('button', { name: '사당역 즐겨찾기', exact: true }).click();
    await oldSaveStarted;
    await submit.click();
    await expect(submit).toBeEnabled();
    const oldSaveFinished = page.waitForResponse('**/api/history/history-1/bookmarks');
    releaseOldSave();
    await oldSaveFinished;
    // The old response must not mark the same hub saved on the new record.
    await expect(page.getByRole('button', { name: '사당역 즐겨찾기', exact: true })).toBeEnabled();
    const newSaveStarted = page.waitForRequest('**/api/history/history-2/bookmarks');
    await page.getByRole('button', { name: '사당역 즐겨찾기', exact: true }).click();
    expect((await newSaveStarted).postDataJSON()).toEqual({ hubIds: ['keep-from-second-record', hub.id] });
});
async function mock(page: Page) {
    await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/history')
            return route.fulfill({ json: { history: [] } });
        if (url.pathname === '/api/history/history-1')
            return route.fulfill({ json: { record: history() } });
        if (url.pathname.startsWith('/api/hubs/'))
            return route.fulfill({ json: { hub } });
        if (url.pathname.startsWith('/api/places/'))
            return route.fulfill({ json: { places } });
        if (url.pathname.endsWith('/bookmarks'))
            return route.fulfill({ json: { record: { ...history(), bookmarkedHubIds: route.request().postDataJSON().hubIds } } });
        if (url.pathname === '/api/recommendations') {
            const body = route.request().postDataJSON();
            return route.fulfill({ json: { status: 'success', recommendations: [{ hubId: hub.id, hub, maxBurdenSeconds: 1800, sumBurdenSeconds: 3600, participantRoutes: body.origins.map((origin: {
                                id: string;
                            }) => ({ originId: origin.id, departureAt: new Date(Date.parse(body.meetingAt) - 1800000).toISOString(), arrivalAt: new Date(Date.parse(body.meetingAt) - 300000).toISOString(), travelSeconds: 1500, earlyWaitSeconds: 300, burdenSeconds: 1800, transfers: 1 })) }], calculatedAt: new Date().toISOString(), dataVersion: 'test', requestId: 'test', historyId: 'history-1', historySaved: true } });
        }
        return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: '기록이 만료되었어요.' } } });
    });
}
async function selectOrigins(page: Page) {
    for (const index of [0, 1]) {
        await page.getByRole('combobox').nth(index).fill('서울');
        await page.getByRole('option', { name: /서울역/ }).click();
    }
}
test('selected origins produce burden details, bookmark, nearby and public share links', async ({ page }) => {
    await mock(page);
    await page.goto('/');
    if (process.env.CAPTURE_UI)
        await page.screenshot({ path: 'test-results/mobile-home.png', fullPage: true });
    await page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('검색 결과에서');
    await selectOrigins(page);
    await page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '사당역', exact: true })).toBeVisible();
    if (process.env.CAPTURE_UI)
        await page.screenshot({ path: 'test-results/mobile-results.png', fullPage: true });
    await page.getByText('이동·도착 자세히').first().click();
    await expect(page.getByText('이동 25분 · 일찍 도착 5분 · 환승 1회').first()).toBeVisible();
    await page.getByRole('button', { name: '사당역 즐겨찾기' }).click();
    await expect(page.getByRole('button', { name: '사당역 즐겨찾기 해제' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '주변 장소 보기' }).click();
    await page.getByRole('button', { name: '식당', exact: true }).click();
    await expect(page.getByRole('link', { name: /서울역/ }).last()).toHaveAttribute('href', places[0].url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});
test('future history recalculates and preserves saved public destinations', async ({ page }) => {
    await mock(page);
    const record = { ...history(), bookmarkedHubIds: ['old-hub'], bookmarkedHubs: [{ ...hub, id: 'old-hub', name: '이전에 저장한 역' }] };
    await page.route('**/api/history', route => route.fulfill({ json: { history: [record] } }));
    await page.route('**/api/history/history-1', route => route.fulfill({ json: { record } }));
    await page.goto('/?view=history');
    await expect(page.getByRole('link', { name: '이전에 저장한 역 ↗' })).toHaveAttribute('href', '/meet/old-hub');
    const request = page.waitForRequest(request => request.url().endsWith('/api/recommendations'));
    await page.getByRole('button', { name: '다시 검색' }).click();
    expect((await request).postDataJSON()).toEqual({ origins, meetingAt: record.meetingAt, historyId: record.id });
    await expect(page.getByRole('heading', { name: '사당역', exact: true })).toBeVisible();
});
test('history individual and all deletion remove only confirmed records', async ({ page }) => {
    await mock(page);
    let records = [history(), { ...history(), id: 'history-2' }];
    await page.route('**/api/history**', async (route) => {
        const url = new URL(route.request().url());
        if (route.request().method() === 'DELETE') {
            records = url.pathname === '/api/history' ? [] : records.filter(record => !url.pathname.endsWith(record.id));
            return route.fulfill({ status: 204 });
        }
        return route.fulfill({ json: { history: records } });
    });
    await page.goto('/?view=history');
    await expect(page.getByRole('button', { name: '기록 삭제' })).toHaveCount(2);
    await page.getByRole('button', { name: '기록 삭제' }).first().click();
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect(page.getByRole('button', { name: '기록 삭제' })).toHaveCount(2);
    await page.getByRole('button', { name: '기록 삭제' }).first().click();
    await page.getByRole('button', { name: '삭제하기', exact: true }).click();
    await expect(page.getByRole('button', { name: '기록 삭제' })).toHaveCount(1);
    await page.getByRole('button', { name: '전체 삭제' }).click();
    await page.getByRole('button', { name: '삭제하기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '다음 만남을 위한 작은 기록' })).toBeVisible();
});
test('share cancellation is neutral and copied public URL has no private information', async ({ page }) => {
    await mock(page);
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('cancel', 'AbortError'); } });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { (window as unknown as {
                    copied: string;
                }).copied = value; } } });
    });
    await page.goto('/meet/hub-1');
    await page.getByRole('button', { name: '공유하기 ↗' }).click();
    await expect(page.getByRole('status').filter({ hasText: '공유를 취소했어요.' })).toHaveText('공유를 취소했어요.');
    await page.getByRole('button', { name: '링크 복사' }).click();
    await expect(page.getByRole('status').filter({ hasText: '링크를 복사했어요.' })).toHaveText('링크를 복사했어요.');
    expect(await page.evaluate(() => (window as unknown as {
        copied: string;
    }).copied)).toBe('http://127.0.0.1:4174/meet/hub-1');
});
test('four-person search uses KST from a different device timezone and handles quota', async ({ page }) => {
    await mock(page);
    await page.goto('/');
    await page.getByRole('button', { name: /참가자 추가/ }).click();
    await page.getByRole('button', { name: /참가자 추가/ }).click();
    await expect(page.getByRole('combobox')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /참가자 추가/ })).toHaveCount(0);
    for (const index of [0, 1, 2, 3]) {
        await page.getByRole('combobox').nth(index).fill('서울');
        await page.getByRole('combobox').nth(index).press('ArrowDown');
        await expect(page.getByRole('option').first()).toBeVisible();
        await page.getByRole('combobox').nth(index).press('ArrowDown');
        await page.getByRole('combobox').nth(index).press('Enter');
    }
    const local = await page.getByLabel('약속 날짜와 시각 (한국 시각)').inputValue();
    await page.route('**/api/recommendations', route => route.fulfill({ status: 429, json: { error: { code: 'QUOTA', message: 'Quota', retryAfter: 15 } } }));
    const request = page.waitForRequest(request => request.url().endsWith('/api/recommendations'));
    await page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true }).click();
    expect((await request).postDataJSON().meetingAt).toBe(new Date(`${local}:00+09:00`).toISOString());
    await expect(page.getByRole('alert')).toContainText('15초 후');
});
test('history write failure preserves recommendation and exposes save failure', async ({ page }) => {
    await mock(page);
    await page.route('**/api/recommendations', route => route.fulfill({ json: { status: 'success', recommendations: [{ hubId: hub.id, hub, maxBurdenSeconds: 1800, sumBurdenSeconds: 3600, participantRoutes: origins.map(origin => ({ originId: origin.id, departureAt: future(), arrivalAt: future(), travelSeconds: 1800, earlyWaitSeconds: 0, burdenSeconds: 1800, transfers: 0 })) }], calculatedAt: new Date().toISOString(), dataVersion: 'test', requestId: 'test', historySaved: false } }));
    await page.goto('/');
    await selectOrigins(page);
    await page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true }).click();
    await expect(page.getByRole('heading', { name: '사당역', exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('기록을 저장하지 못했어요');
    await page.getByRole('button', { name: '사당역 즐겨찾기' }).click();
    await expect(page.getByRole('alert')).toContainText('즐겨찾기를 남길 수 없어요');
});
test('past history restores inputs and requires a new time before recalculation', async ({ page }) => {
    await mock(page);
    const record = { ...history(), meetingAt: '2020-01-01T10:00:00+09:00' };
    await page.route('**/api/history', route => route.fulfill({ json: { history: [record] } }));
    await page.route('**/api/history/history-1', route => route.fulfill({ json: { record } }));
    let requests = 0;
    page.on('request', request => { if (request.url().endsWith('/api/recommendations'))
        requests++; });
    await page.goto('/');
    await page.getByRole('button', { name: '내 기록' }).click();
    await page.getByRole('button', { name: '다시 검색' }).click();
    await expect(page.getByRole('alert')).toContainText('새 약속 시각');
    await expect(page.getByRole('combobox').first()).toHaveValue('서울역');
    expect(requests).toBe(0);
});
test('direct hub opens without private inputs and map unavailable retains external destination', async ({ page }) => {
    await mock(page);
    await page.goto('/meet/hub-1');
    await expect(page.getByRole('heading', { name: '사당역', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await page.getByRole('button', { name: '지도 보기', exact: true }).click();
    await expect(page.getByText(/지도를 불러오지 못했어요/)).toBeVisible();
    await expect(page.getByRole('link', { name: '카카오맵에서 보기' })).toHaveAttribute('href', /map.kakao.com/);
});
test('cancelled search never presents a stale recommendation', async ({ page }) => {
    await mock(page);
    await page.route('**/api/recommendations', async (route) => { await new Promise(resolve => setTimeout(resolve, 1500)); await route.fulfill({ json: { status: 'no_routes', recommendations: [], calculatedAt: future(), dataVersion: 'test', requestId: 'x' } }).catch(() => { }); });
    await page.goto('/');
    await selectOrigins(page);
    await page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true }).click();
    await page.getByRole('button', { name: '검색 취소' }).click();
    await expect(page.getByRole('status')).toContainText('검색을 취소');
    await page.waitForTimeout(1700);
    await expect(page.getByText('이 조건으로는 만날 곳을 찾지 못했어요')).toHaveCount(0);
});
test('shows at most four recommendations and no persisted route response', async ({ page }) => {
    await mock(page);
    await page.route('**/api/recommendations', route => {
        const body = route.request().postDataJSON();
        return route.fulfill({ json: { status: 'success', recommendations: Array.from({ length: 5 }, (_, index) => ({ hubId: `hub-${index}`, hub: { ...hub, id: `hub-${index}`, name: `만날 역 ${index + 1}` }, maxBurdenSeconds: 1800, sumBurdenSeconds: 3600, participantRoutes: body.origins.map((origin: {
                        id: string;
                    }) => ({ originId: origin.id, departureAt: new Date(Date.parse(body.meetingAt) - 1800000).toISOString(), arrivalAt: body.meetingAt, travelSeconds: 1800, earlyWaitSeconds: 0, burdenSeconds: 1800, transfers: 0 })) })), calculatedAt: new Date().toISOString(), dataVersion: 'test', requestId: 'test', historyId: 'history-1', historySaved: true } });
    });
    await page.goto('/');
    await selectOrigins(page);
    await page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true }).click();
    await expect(page.getByRole('heading', { name: /^만날 역/ })).toHaveCount(4);
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
    await page.reload();
    await expect(page.getByRole('heading', { name: /^만날 역/ })).toHaveCount(0);
});
test('removing the last bookmark can remove an expired history record', async ({ page }) => {
    await mock(page);
    const record = { ...history(), bookmarkedHubIds: [hub.id], bookmarkedHubs: [hub] };
    await page.route('**/api/history', route => route.fulfill({ json: { history: [record] } }));
    await page.route('**/api/history/history-1/bookmarks', route => route.fulfill({ json: { record: null } }));
    await page.goto('/?view=history');
    await page.getByRole('button', { name: '사당역 즐겨찾기 해제' }).click();
    await expect(page.getByRole('heading', { name: '다음 만남을 위한 작은 기록' })).toBeVisible();
});
test('editing selected text invalidates coordinates and offline prevents search', async ({ page, context }) => {
    await mock(page);
    await page.goto('/');
    await selectOrigins(page);
    await page.getByRole('combobox').first().fill('부');
    await page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('검색 결과에서');
    await context.setOffline(true);
    await expect(page.getByRole('status')).toContainText('인터넷에 연결되어 있지 않아요');
    await expect(page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true })).toBeDisabled();
});
test('clipboard denial provides a manually selectable public URL', async ({ page }) => {
    await mock(page);
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } } }));
    await page.goto('/meet/hub-1');
    await page.getByRole('button', { name: '링크 복사' }).click();
    await expect(page.getByLabel('복사할 링크')).toHaveValue('http://127.0.0.1:4174/meet/hub-1');
    await expect(page.getByRole('status').filter({ hasText: '직접 선택' })).toBeVisible();
});
test('empty routes and provider failures are distinct and accessible', async ({ page }) => {
    await mock(page);
    await page.route('**/api/recommendations', route => route.fulfill({ json: { status: 'no_routes', recommendations: [], calculatedAt: new Date().toISOString(), dataVersion: 'test', requestId: 'test', historyId: 'history-1', historySaved: true } }));
    await page.goto('/');
    await selectOrigins(page);
    const submit = page.getByRole('region', { name: '만날 곳 검색' }).getByRole('button', { name: '만날 곳 찾기', exact: true });
    await submit.click();
    await expect(page.getByRole('heading', { name: '이 조건으로는 만날 곳을 찾지 못했어요' })).toBeVisible();
    await page.route('**/api/recommendations', route => route.fulfill({ status: 503, json: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'Provider unavailable' } } }));
    await submit.click();
    await expect(page.getByRole('alert')).toContainText('지금은 정보를 불러올 수 없어요');
    await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.getByRole('heading', { name: '이 조건으로는 만날 곳을 찾지 못했어요' })).toHaveCount(0);
});
test('tablet desktop and 200 percent zoom retain usable controls', async ({ page }) => {
    await mock(page);
    await page.goto('/');
    for (const width of [768, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (process.env.CAPTURE_UI)
            await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 720, height: 1200 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await expect(page.getByRole('combobox').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('malformed public URL shows a friendly invalid-link page', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', error => errors.push(error));
    await page.addInitScript(() => window.history.replaceState({}, '', '/meet/%'));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '올바르지 않은 만남 링크예요' })).toBeVisible();
    expect(errors).toEqual([]);
});
test('leaving history while restore is pending does not replace the current screen', async ({ page }) => {
    await mock(page);
    await page.route('**/api/history', route => route.fulfill({ json: { history: [history()] } }));
    await page.route('**/api/history/history-1', async (route) => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.fulfill({ json: { record: history() } }).catch(() => { }); });
    await page.goto('/?view=history');
    await page.getByRole('button', { name: '다시 검색' }).click();
    await page.getByRole('navigation').getByRole('button', { name: '만날 곳 찾기' }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('combobox').first()).toHaveValue('');
    await expect(page.getByRole('heading', { name: '사당역', exact: true })).toHaveCount(0);
});
