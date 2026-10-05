import { useEffect, useRef, useState } from 'react';
import type { Hub } from './shared';
type KakaoMaps = {
    load: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => object;
    Map: new (element: HTMLElement, options: {
        center: object;
        level: number;
    }) => object;
    Marker: new (options: {
        position: object;
        map: object;
    }) => object;
};
declare global {
    interface Window {
        kakao?: {
            maps: KakaoMaps;
        };
    }
}
let sdk: Promise<KakaoMaps> | undefined;
function loadMap(): Promise<KakaoMaps> {
    if (sdk)
        return sdk;
    sdk = new Promise<KakaoMaps>((resolve, reject) => {
        const key = (import.meta as ImportMeta & {
            env: Record<string, string>;
        }).env.VITE_KAKAO_JS_KEY;
        if (!key) {
            reject(new Error('Map unavailable'));
            return;
        }
        const script = document.createElement('script');
        const timer = setTimeout(() => reject(new Error('Map timeout')), 10000);
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
        script.async = true;
        script.onload = () => { const maps = window.kakao?.maps; if (!maps) {
            clearTimeout(timer);
            reject(new Error('Map unavailable'));
            return;
        } maps.load(() => { clearTimeout(timer); resolve(maps); }); };
        script.onerror = () => { clearTimeout(timer); reject(new Error('Map unavailable')); };
        document.head.appendChild(script);
    }).catch(error => { sdk = undefined; throw error; });
    return sdk;
}
export const mapUrl = (hub: Hub) => `https://map.kakao.com/link/map/${encodeURIComponent(hub.name)},${hub.lat},${hub.lng}`;
export default function Map({ hub }: {
    hub: Hub;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    useEffect(() => { if (state !== 'loading')
        return; let live = true; loadMap().then(maps => { if (!live || !ref.current)
        return; const position = new maps.LatLng(hub.lat, hub.lng); const map = new maps.Map(ref.current, { center: position, level: 4 }); new maps.Marker({ position, map }); setState('ready'); }).catch(() => { if (live)
        setState('error'); }); return () => { live = false; }; }, [hub, state]);
    return <section className="map-section" aria-label={`${hub.name} 위치`}>
    <div className={`map-surface map-${state}`} aria-label={`${hub.name} 지도`}>
      <div className="map-canvas" ref={ref}/>
      {state === 'idle' && <div className="map-placeholder"><span className="map-pin" aria-hidden="true">⌖</span><strong>{hub.name}</strong><p>만날 곳의 위치를 확인해 보세요</p><button className="secondary" onClick={() => setState('loading')}>지도 보기</button></div>}
      {state === 'loading' && <p role="status">지도를 불러오고 있어요…</p>}
      {state === 'error' && <div className="map-placeholder"><strong>지도를 불러오지 못했어요</strong><p>아래 카카오맵 링크에서 위치를 확인할 수 있어요.</p><button className="text-button" onClick={() => setState('loading')}>지도 다시 시도</button></div>}
    </div>
    <a className="external-link" href={mapUrl(hub)} target="_blank" rel="noopener noreferrer">카카오맵에서 보기 <span aria-hidden="true">↗</span></a>
  </section>;
}
