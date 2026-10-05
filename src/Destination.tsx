import { lazy, Suspense, useEffect, useState } from 'react';
import type { Category, Hub, Place } from './shared';
import { api, errorMessage, safePlaceUrl } from './api';
const Map = lazy(() => import('./Map'));
const categories: {
    id: Category;
    label: string;
    icon: string;
}[] = [{ id: 'restaurant', label: '식당', icon: '♧' }, { id: 'cafe', label: '카페', icon: '☕' }, { id: 'culture', label: '문화·놀거리', icon: '◇' }];
export function Share({ name, url }: {
    name: string;
    url: string;
}) {
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [manual, setManual] = useState(false);
    async function share(copy: boolean) {
        if (busy)
            return;
        setBusy(true);
        setMessage('');
        setManual(false);
        try {
            if (!copy && navigator.share) {
                await navigator.share({ title: `${name}에서 만나요`, text: `${name}에서 만나요.`, url });
                setMessage('공유했어요.');
            }
            else {
                await navigator.clipboard.writeText(url);
                setMessage('링크를 복사했어요.');
            }
        }
        catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError')
                setMessage('공유를 취소했어요.');
            else {
                setMessage('링크를 직접 선택해서 복사해 주세요.');
                setManual(true);
            }
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="share-tools"><div className="button-row"><button className="secondary" disabled={busy} onClick={() => void share(false)}>공유하기 ↗</button><button className="text-button" disabled={busy} onClick={() => void share(true)}>링크 복사</button></div>{message && <p className="small" role="status">{message}</p>}{manual && <input className="copy-input" aria-label="복사할 링크" readOnly value={url} onFocus={event => event.target.select()}/>}</div>;
}
export function Nearby({ hub }: {
    hub: Hub;
}) {
    const [category, setCategory] = useState<Category | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        if (!category)
            return;
        const controller = new AbortController();
        setBusy(true);
        setError('');
        setPlaces([]);
        api<{
            places: Place[];
        }>(`/places/nearby?hubId=${encodeURIComponent(hub.id)}&category=${category}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted)
            setPlaces(result.places.slice(0, 15)); }).catch(error => { if (!controller.signal.aborted)
            setError(errorMessage(error)); }).finally(() => { if (!controller.signal.aborted)
            setBusy(false); });
        return () => controller.abort();
    }, [hub.id, category, retry]);
    return <section className="nearby"><div className="section-heading"><div><h3>만난 다음엔, 어디로?</h3><p>거점 주변 800m 이내 장소</p></div></div><div className="category-row" aria-label="주변 장소 종류">{categories.map(item => <button key={item.id} className={`category ${category === item.id ? 'active' : ''}`} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</div>
      {!category && <p className="empty-note">종류를 선택하면 주변 장소를 찾아드려요.</p>}
      {busy && <p role="status" className="empty-note">주변 장소를 찾고 있어요…</p>}
      {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></div>}
      {category && !busy && !error && places.length === 0 && <p className="empty-note">이 종류의 주변 장소를 찾지 못했어요. 다른 종류를 선택해 보세요.</p>}
      <div className="nearby-list">{places.map(place => { const url = safePlaceUrl(place.url); return <article className="nearby-place" key={place.id}><div className="place-symbol" aria-hidden="true">↗</div><div><h4>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{place.name} ↗</a> : place.name}</h4><p>{place.category}{place.distance != null ? ` · 직선거리 ${Math.round(place.distance)}m` : ''}</p><p>{place.address}</p>{url && <Share name={place.name} url={url}/>}</div></article>; })}</div>
  </section>;
}
export function Destination({ hub }: {
    hub: Hub;
}) {
    return <div className="destination"><Suspense fallback={<p role="status">지도 준비 중…</p>}><Map key={hub.id} hub={hub}/></Suspense><Nearby hub={hub}/></div>;
}
export function PublicMeeting({ hubId }: {
    hubId: string;
}) {
    const [hub, setHub] = useState<Hub | null>(null);
    const [error, setError] = useState('');
    useEffect(() => { const controller = new AbortController(); api<{
        hub: Hub;
    }>(`/hubs/${encodeURIComponent(hubId)}`, { signal: controller.signal }).then(value => setHub(value.hub)).catch(error => { if (!controller.signal.aborted)
        setError(errorMessage(error)); }); return () => controller.abort(); }, [hubId]);
    if (error)
        return <div className="empty-state"><h1>이 만날 곳을 찾지 못했어요</h1><p role="alert">{error}</p><a className="primary" href="/">새 만남 찾기</a></div>;
    if (!hub)
        return <p className="empty-note" role="status">만날 곳을 불러오고 있어요…</p>;
    return <main className="public-page"><a className="back-link" href="/">← 새로운 만날 곳 찾기</a><div className="public-heading"><div><span className="eyebrow">여기서 만나요</span><h1>{hub.name}</h1><p>{hub.kind === 'rail' ? '대중교통 철도 거점' : '대중교통 버스 거점'} · 출발지 정보가 없는 공개 장소예요</p></div><Share name={hub.name} url={`${location.origin}/meet/${encodeURIComponent(hub.id)}`}/></div><Destination hub={hub}/></main>;
}
