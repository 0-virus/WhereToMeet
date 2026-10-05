import type { ApiError } from './shared';
export class RequestError extends Error {
    status: number;
    code: string;
    retryAfter?: number;
    constructor(message: string, status = 0, code = '', retryAfter?: number) { super(message); this.status = status; this.code = code; this.retryAfter = retryAfter; }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`/api${path}`, { ...init, cache: 'no-store', credentials: 'same-origin', headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
    }
    catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
            throw error;
        throw new RequestError('인터넷 연결을 확인하고 다시 시도해 주세요.');
    }
    if (!response.ok) {
        const body = await response.json().catch(() => null) as ApiError | null;
        const retry = body?.error.retryAfter ?? (Number(response.headers.get('Retry-After')) || undefined);
        const message = response.status === 429 ? `잠시 요청이 많아요. ${retry ? `${retry}초 후 ` : '잠시 후 '}다시 시도해 주세요.`
            : response.status === 401 || response.status === 404 ? '기록이 만료되었거나 이 브라우저의 기록이 아니에요. 새로 검색해 주세요.'
                : response.status === 504 ? '교통 정보를 확인하는 데 시간이 오래 걸려요. 잠시 후 다시 시도해 주세요.'
                    : response.status >= 500 ? '지금은 정보를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.'
                        : body?.error.message || '요청을 처리하지 못했어요. 입력을 확인해 주세요.';
        throw new RequestError(message, response.status, body?.error.code, retry);
    }
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.';
export const localKst = (date: Date) => new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 16);
export const meetingISO = (value: string) => new Date(`${value}:00+09:00`).toISOString();
export const minutes = (seconds: number) => `${Math.ceil(seconds / 60)}분`;
export const timeKst = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
export function safePlaceUrl(value: string) {
    try {
        const url = new URL(value);
        return !url.username && !url.password && ['https://place.map.kakao.com', 'https://map.kakao.com'].includes(url.origin) ? url.href : null;
    }
    catch {
        return null;
    }
}
