import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorMessage, localKst, meetingISO, minutes, RequestError, timeKst } from './api';
import { PlaceInput, type OriginDraft } from './PlaceInput';
import { Destination, PublicMeeting, Share } from './Destination';
import { History } from './History';
import { MAX_MEETING_DAYS, MAX_RECOMMENDATIONS, type HistoryRecord, type Hub, type Origin, type Recommendation, type RecommendResponse } from './shared';
function Header({ page, onPage }: {
    page: string;
    onPage: (page: 'search' | 'history') => void;
}) { return <header className="site-header"><a href="/" className="brand" aria-label="어디서 만나 홈"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 24C2 20 8 5 13 6c4 1 5 17 10 18 6 1 6-7 2-9-4-3-13 10-18 9Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg><span>어디서 만나</span></a><nav aria-label="주 메뉴"><button className={page === 'search' ? 'nav-active' : ''} onClick={() => onPage('search')}>만날 곳 찾기</button><button className={page === 'history' ? 'nav-active' : ''} onClick={() => onPage('history')}>내 기록</button></nav><span className="header-note">함께 가는 길, 조금 더 편하게</span></header>; }
function Privacy() { return <main className="privacy-page"><a href="/" className="back-link">← 만날 곳 찾기</a><span className="eyebrow">개인정보 안내</span><h1>우리의 만남에 필요한 정보만</h1><p>어디서 만나는 회원가입 없이 이용하는 서비스예요.</p><h2>검색과 익명 기록</h2><p>선택한 출발지 이름·주소·좌표, 약속 시각, 검색 시각과 즐겨찾기 거점 ID를 서버에 저장해요. 이 브라우저의 보안 쿠키로 기록을 구분하고, 서버에는 쿠키 토큰의 해시를 저장해요. 다른 기기와 동기화하지 않으며, 쿠키를 지우면 기존 기록에 접근하지 못할 수 있어요.</p><h2>보관과 삭제</h2><p>일반 검색 기록은 마지막으로 성공한 검색 또는 경로 없음 결과를 받은 날부터 90일 동안 보관해요. 즐겨찾기가 있는 기록은 직접 삭제할 때까지 보관해요. 90일이 지난 기록의 마지막 즐겨찾기를 해제하면 해당 기록도 삭제해요. 내 기록에서 개별 기록 또는 모든 기록을 삭제할 수 있어요.</p><h2>교통 정보와 외부 서비스</h2><p>경로 응답은 영구 저장하거나 캐시하지 않아요. 기록을 다시 열 때마다 새로 계산해요. 장소 검색에는 Kakao, 교통 계산에는 TravelTime 서비스를 이용하며 필요한 검색어와 좌표·약속 시각을 전달해요. 지도 보기를 선택하면 Kakao 지도 서비스가 연결돼요.</p><h2>공유와 이용 통계</h2><p>공유 링크에는 공개 거점 또는 선택한 가게만 포함해요. 참가자의 출발지와 약속 시각은 포함하지 않아요. 개인 기록과 별도로 서비스 개선을 위한 검색 요약 통계는 90일 보관해요. 요약에는 출발지·주소·쿠키 토큰·개인별 경로를 넣지 않아요.</p><h2>운영자 문의</h2><p>{import.meta.env.VITE_OPERATOR_NAME || '운영자 이름: 공개 운영 전 설정 필요'} · {import.meta.env.VITE_OPERATOR_CONTACT || '개인정보 문의 연락처: 공개 운영 전 설정 필요'}</p></main>; }
function RecommendationCard({ recommendation, rank, origins, saved, onBookmark, saving }: {
    recommendation: Recommendation & {
        hub: Hub;
    };
    rank: number;
    origins: Origin[];
    saved: boolean;
    onBookmark: () => void;
    saving: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const hub = recommendation.hub;
    return <article className="recommendation-card"><div className="card-heading"><div><span className={`badge ${rank === 0 ? 'best' : ''}`}>{rank === 0 ? '가장 큰 부담이 가장 적은 곳' : `추천 ${rank + 1}`}</span><h2>{hub.name}</h2><p>{hub.kind === 'rail' ? '철도 거점' : '버스 거점'} · {origins.length}명 모두의 예상 경로</p></div><button className={`heart ${saved ? 'saved' : ''}`} aria-label={`${hub.name} 즐겨찾기${saved ? ' 해제' : ''}`} aria-pressed={saved} onClick={onBookmark} disabled={saving}>{saved ? '♥' : '♡'}</button></div>
    <div className="burden-summary"><div><span>가장 오래 걸리는 사람</span><strong>{minutes(recommendation.maxBurdenSeconds)}</strong></div><p>출발부터 약속까지<br />이동 + 일찍 도착한 대기</p></div>
    <ul className="routes">{recommendation.participantRoutes.map((route, index) => <li key={route.originId}><span className="person-number">{index + 1}</span><div className="route-body"><div><strong>{origins.find(origin => origin.id === route.originId)?.label || `참가자 ${index + 1}`}</strong><strong>{minutes(route.burdenSeconds)}</strong></div><p>예상 출발 {timeKst(route.departureAt)}</p><details><summary>이동·도착 자세히</summary><p>예상 도착 {timeKst(route.arrivalAt)}</p><p>이동 {minutes(route.travelSeconds)} · 일찍 도착 {minutes(route.earlyWaitSeconds)} · 환승 {route.transfers}회</p></details></div></li>)}</ul>
    <div className="card-actions"><button className="secondary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '주변 장소 접기' : '주변 장소 보기'}</button><Share name={hub.name} url={`${location.origin}/meet/${encodeURIComponent(hub.id)}`}/></div>
    {expanded && <Destination hub={hub}/>}
  </article>;
}
type Result = Omit<RecommendResponse, 'recommendations'> & {
    origins: Origin[];
    meetingAt: string;
    recommendations: (Recommendation & {
        hub: Hub;
    })[];
};
export default function App() {
    const [page, setPage] = useState<'search' | 'history'>('search');
    const [origins, setOrigins] = useState<OriginDraft[]>([{ id: 'person-1', text: '' }, { id: 'person-2', text: '' }]);
    const [meeting, setMeeting] = useState(() => localKst(new Date(Date.now() + 24 * 3600000)));
    const [historyId, setHistoryId] = useState<string>();
    const [result, setResult] = useState<Result | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [refresh, setRefresh] = useState(0);
    const [saved, setSaved] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [bookmarksReady, setBookmarksReady] = useState(false);
    const [offline, setOffline] = useState(!navigator.onLine);
    const [now, setNow] = useState(Date.now());
    const request = useRef<AbortController | null>(null);
    const restoreRequest = useRef<AbortController | null>(null);
    const alert = useRef<HTMLDivElement>(null);
    const resultRef = useRef<HTMLElement>(null);
    useEffect(() => { const online = () => setOffline(!navigator.onLine); addEventListener('online', online); addEventListener('offline', online); const timer = setInterval(() => setNow(Date.now()), 30000); return () => { removeEventListener('online', online); removeEventListener('offline', online); clearInterval(timer); request.current?.abort(); restoreRequest.current?.abort(); }; }, []);
    useEffect(() => { if (error)
        alert.current?.focus(); }, [error]);
    function cancel() { request.current?.abort(); request.current = null; setBusy(false); setResult(null); setMessage('검색을 취소했어요. 조건을 바꾸고 다시 찾아보세요.'); }
    function navigate(next: 'search' | 'history') { restoreRequest.current?.abort(); restoreRequest.current = null; if (location.pathname !== '/') {
        location.href = next === 'history' ? '/?view=history' : '/';
        return;
    } if (busy)
        cancel(); setPage(next); setError(''); }
    useEffect(() => { if (new URLSearchParams(location.search).get('view') === 'history')
        setPage('history'); }, []);
    function edit() { setResult(null); setHistoryId(undefined); setError(''); setMessage(''); }
    async function search(selected: Origin[], time: string, recordId?: string) {
        if (request.current)
            return;
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        setError('');
        setMessage('');
        setResult(null);
        setBookmarksReady(false);
        const timer = setTimeout(() => { if (request.current === controller) {
            controller.abort();
            request.current = null;
            setBusy(false);
            setError('검색 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.');
        } }, 32000);
        try {
            const response = await api<RecommendResponse>('/recommendations', { method: 'POST', body: JSON.stringify({ origins: selected, meetingAt: time, ...(recordId ? { historyId: recordId } : {}) }), signal: controller.signal });
            const recommendations = await Promise.all(response.recommendations.slice(0, MAX_RECOMMENDATIONS).map(async (item) => ({ ...item, hub: item.hub || (await api<{
                    hub: Hub;
                }>(`/hubs/${encodeURIComponent(item.hubId)}`, { signal: controller.signal })).hub })));
            if (request.current !== controller || controller.signal.aborted)
                return;
            setResult({ ...response, recommendations, origins: selected, meetingAt: time });
            setHistoryId(response.historyId);
            setSaved([]);
            setRefresh(value => value + 1);
            if (response.historySaved === false || response.warning)
                setMessage('추천은 확인했지만 검색 기록을 저장하지 못했어요. 즐겨찾기는 기록 저장 후 이용할 수 있어요.');
            if (response.historyId && response.historySaved !== false) {
                try {
                    const value = await api<{
                        record: HistoryRecord;
                    }>(`/history/${encodeURIComponent(response.historyId)}`, { signal: controller.signal });
                    if (!controller.signal.aborted) {
                        setSaved(value.record.bookmarkedHubIds);
                        setBookmarksReady(true);
                    }
                }
                catch {
                    if (!controller.signal.aborted)
                        setMessage('검색 결과는 확인할 수 있지만 즐겨찾기 정보를 불러오지 못했어요. 내 기록에서 다시 확인해 주세요.');
                }
            }
            requestAnimationFrame(() => resultRef.current?.focus());
        }
        catch (error) {
            if (!controller.signal.aborted && request.current === controller) {
                setError(errorMessage(error));
                if (error instanceof RequestError && [401, 404].includes(error.status))
                    setHistoryId(undefined);
            }
        }
        finally {
            clearTimeout(timer);
            if (request.current === controller) {
                request.current = null;
                setBusy(false);
            }
        }
    }
    function submit(event: FormEvent) {
        event.preventDefault();
        if (busy)
            return;
        setError('');
        if (origins.some(origin => !origin.selected)) {
            setError('각 참가자의 출발지를 검색 결과에서 선택해 주세요.');
            return;
        }
        const timestamp = Date.parse(`${meeting}:00+09:00`);
        if (!Number.isFinite(timestamp) || timestamp <= Date.now() || timestamp > Date.now() + MAX_MEETING_DAYS * 86400000) {
            setError('약속 시각은 지금 이후부터 7일 이내로 선택해 주세요.');
            return;
        }
        void search(origins.map(origin => origin.selected!), meetingISO(meeting), historyId);
    }
    async function restore(id: string) {
        restoreRequest.current?.abort();
        const controller = new AbortController();
        restoreRequest.current = controller;
        setError('');
        setMessage('');
        try {
            const { record } = await api<{
                record: HistoryRecord;
            }>(`/history/${encodeURIComponent(id)}`, { signal: controller.signal });
            if (controller.signal.aborted || restoreRequest.current !== controller)
                return;
            restoreRequest.current = null;
            setOrigins(record.origins.map(origin => ({ id: origin.id, text: origin.label, selected: origin })));
            setMeeting(localKst(new Date(record.meetingAt)));
            setHistoryId(record.id);
            setResult(null);
            setPage('search');
            if (Date.parse(record.meetingAt) <= Date.now() || Date.parse(record.meetingAt) > Date.now() + MAX_MEETING_DAYS * 86400000) {
                setError('지난 약속이에요. 새 약속 시각을 선택하고 다시 검색해 주세요.');
                return;
            }
            await search(record.origins, record.meetingAt, record.id);
        }
        catch (error) {
            if (controller.signal.aborted)
                return;
            restoreRequest.current = null;
            setPage('search');
            setError(errorMessage(error));
            setHistoryId(undefined);
            setRefresh(value => value + 1);
        }
    }
    async function bookmark(hubId: string) { if (!result?.historyId || result.historySaved === false || !bookmarksReady) {
        setError('이 검색 기록이 저장되지 않아 즐겨찾기를 남길 수 없어요. 다시 검색해 주세요.');
        return;
    } setSaving(true); setError(''); try {
        const hubIds = saved.includes(hubId) ? saved.filter(id => id !== hubId) : [...saved, hubId];
        const value = await api<{
            record: HistoryRecord | null;
        }>(`/history/${encodeURIComponent(result.historyId)}/bookmarks`, { method: 'PATCH', body: JSON.stringify({ hubIds }) });
        setSaved(value.record?.bookmarkedHubIds || []);
        setRefresh(value => value + 1);
    }
    catch (error) {
        setError(errorMessage(error));
    }
    finally {
        setSaving(false);
    } }
    const hubMatch = location.pathname.match(/^\/meet\/([^/]+)\/?$/);
    let decodedHubId: string | null = null;
    if (hubMatch) {
        try {
            decodedHubId = decodeURIComponent(hubMatch[1]);
        }
        catch { /* Render an invalid-link state below. */ }
    }
    const stale = result?.recommendations.some(item => item.participantRoutes.some(route => Date.parse(route.departureAt) <= now));
    return <><a href="#main-content" className="skip-link">본문으로 바로가기</a><Header page={hubMatch || location.pathname === '/privacy' ? '' : page} onPage={navigate}/>
    {offline && <div className="offline-banner" role="status">인터넷에 연결되어 있지 않아요. 연결 후 다시 검색해 주세요.</div>}
    <div id="main-content" className="page-container">
      {hubMatch ? decodedHubId ? <PublicMeeting hubId={decodedHubId}/> : <main className="empty-state"><h1>올바르지 않은 만남 링크예요</h1><p>링크를 다시 확인하거나 새로운 만날 곳을 찾아보세요.</p><a className="primary" href="/">새 만남 찾기</a></main> : location.pathname === '/privacy' ? <Privacy /> : <main>
        {error && <div ref={alert} tabIndex={-1} role="alert" className="notice error global-notice">{error}</div>}
        {page === 'history' ? <History refresh={refresh} onRestore={restore}/> : <>
          <section className="hero"><span className="eyebrow">서울 · 경기 · 인천</span><h1>우리, <span>어디서 만날까요?</span></h1><p>각자의 출발지는 달라도, 만남은 가볍게.<br />모두의 대중교통 이동시간을 함께 비교해요.</p></section>
          <section className="search-section" aria-label="만날 곳 검색"><form onSubmit={submit} noValidate><div className="search-topline"><h2>어디에서 출발하나요?</h2><span>{origins.length}명 함께</span></div><div className="origin-grid">{origins.map((origin, index) => <PlaceInput key={origin.id} value={origin} index={index} disabled={busy} onChange={value => { edit(); setOrigins(items => items.map(item => item.id === value.id ? value : item)); }} onRemove={origins.length > 2 ? () => { edit(); setOrigins(items => items.filter(item => item.id !== origin.id)); } : undefined}/>)}</div>
            {origins.length < 4 && <button type="button" className="add-person" disabled={busy} onClick={() => { edit(); setOrigins(items => [...items, { id: `person-${crypto.randomUUID()}`, text: '' }]); }}>＋ 참가자 추가 <span>최대 4명</span></button>}
            <div className="search-bottom"><div className="meeting-field"><span className="calendar-icon" aria-hidden="true">▦</span><div className="input-stack"><label htmlFor="meeting">언제 만날까요? <span>한국 시각</span></label><input type="datetime-local" id="meeting" aria-label="약속 날짜와 시각 (한국 시각)" value={meeting} min={localKst(new Date())} max={localKst(new Date(Date.now() + MAX_MEETING_DAYS * 86400000))} disabled={busy} onChange={event => { setMeeting(event.target.value); setResult(null); setError(''); }}/></div></div><button type="submit" className="primary search-button" disabled={busy || offline}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="2"/><path d="m15 15 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>{busy ? '만날 곳 찾는 중…' : '만날 곳 찾기'}</button></div>
          </form><p className="search-caption">현재부터 7일 이내 · 버스와 지하철 · 위치 권한 없이 검색</p></section>
          {busy && <div className="search-progress"><span className="spinner" aria-hidden="true"/><div><strong role="status">모두에게 편한 길을 비교하고 있어요</strong><p>각자의 출발·도착 시각까지 확인해요. 최대 30초가 걸릴 수 있어요.</p></div><button className="text-button" onClick={cancel}>검색 취소</button></div>}
          {message && <p className="notice" role="status">{message}</p>}
          {result && <section className="results" ref={resultRef} tabIndex={-1} aria-label="추천 결과"><div className="section-heading"><div><span className="eyebrow">모두의 시간을 생각한 선택</span><h2>{result.status === 'no_routes' ? '이 조건으로는 만날 곳을 찾지 못했어요' : `우리에게 편한 만날 곳 ${result.recommendations.length}곳`}</h2><p>{timeKst(result.meetingAt)} 도착 약속 · 한국 시각</p></div></div>
            {result.status === 'no_routes' ? <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌖</span><p>모든 참가자가 도착할 수 있는 경로를 확인하지 못했어요.<br />약속 시각이나 출발지를 바꾸어 다시 찾아보세요.</p></div> : <><p className="results-note">가장 오래 걸리는 사람의 부담이 적은 순서예요. 시간에는 이동과 일찍 도착한 뒤의 대기가 포함돼요.</p>{stale && <div className="notice error" role="alert">예상 출발시각이 지난 경로가 있어요. 출발 전에 다시 검색해 주세요.</div>}<div className="recommendations">{result.recommendations.map((recommendation, rank) => <RecommendationCard key={`${result.requestId}-${recommendation.hubId}`} recommendation={recommendation} rank={rank} origins={result.origins} saved={saved.includes(recommendation.hubId)} saving={saving || busy} onBookmark={() => void bookmark(recommendation.hubId)}/>)}</div></>}
            <p className="calculated-note">{timeKst(result.calculatedAt)} 계산 · 예상 시간이며 실제 운행 상황에 따라 달라질 수 있어요.</p>
          </section>}
          {!result && !busy && <section className="how-it-works"><div><span className="step-icon" aria-hidden="true">↗</span><h3>각자의 출발지에서</h3><p>2명부터 4명까지<br />익숙한 장소로 출발지를 정해요.</p></div><div><span className="step-icon" aria-hidden="true">◷</span><h3>한 사람에게 치우치지 않게</h3><p>가장 오래 걸리는 사람의<br />부담을 먼저 줄여요.</p></div><div><span className="step-icon" aria-hidden="true">♡</span><h3>만나는 순간까지 편하게</h3><p>주변 장소를 고르고<br />만날 곳 링크를 공유해요.</p></div></section>}
        </>}
      </main>}
    </div><footer className="site-footer"><span className="brand-small">어디서 만나</span><p>우리 모두에게 편한 만남</p><a href="/privacy">개인정보 안내</a><span>대한민국 · 한국 시각 (KST)</span></footer></>;
}
