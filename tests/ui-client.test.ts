import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, localKst, meetingISO, RequestError, safePlaceUrl } from '../src/api.ts';
test('KST input conversion is explicit across a UTC day boundary', () => {
    assert.equal(localKst(new Date('2026-10-05T17:30:00Z')), '2026-10-06T02:30');
    assert.equal(meetingISO('2026-10-06T02:30'), '2026-10-05T17:30:00.000Z');
});
test('external links allow only HTTPS Kakao origins without credentials', () => {
    assert.equal(safePlaceUrl('https://place.map.kakao.com/123'), 'https://place.map.kakao.com/123');
    for (const value of ['javascript:alert(1)', 'http://place.map.kakao.com/123', 'https://place.map.kakao.com.evil.test/123', 'https://user:secret@place.map.kakao.com/123', 'https://place.map.kakao.com:444/123'])
        assert.equal(safePlaceUrl(value), null);
});
test('API requests force no-store and same-origin cookie handling', async (t) => {
    let observed: RequestInit | undefined;
    t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => { observed = init; return new Response(JSON.stringify({ value: 1 }), { status: 200 }); });
    assert.deepEqual(await api('/history', { cache: 'force-cache', credentials: 'include' }), { value: 1 });
    assert.equal(observed?.cache, 'no-store');
    assert.equal(observed?.credentials, 'same-origin');
});
test('quota feedback retains retry delay and DELETE accepts an empty response', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { code: 'QUOTA', message: 'limit', retryAfter: 7 } }), { status: 429 }));
    await assert.rejects(api('/recommendations'), error => error instanceof RequestError && error.retryAfter === 7 && error.message.includes('7초 후'));
    fetchMock.mock.mockImplementation(async () => new Response(null, { status: 204 }));
    assert.equal(await api('/history', { method: 'DELETE' }), undefined);
});
