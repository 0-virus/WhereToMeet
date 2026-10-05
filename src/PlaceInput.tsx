import { useEffect, useRef, useState } from 'react';
import type { Origin, Place } from './shared';
import { api, errorMessage } from './api';
export type OriginDraft = {
    id: string;
    text: string;
    selected?: Origin;
};
export function PlaceInput({ value, index, onChange, onRemove, disabled }: {
    value: OriginDraft;
    index: number;
    onChange: (value: OriginDraft) => void;
    onRemove?: () => void;
    disabled: boolean;
}) {
    const [places, setPlaces] = useState<Place[]>([]);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        setPlaces([]);
        setError('');
        setActive(-1);
        setBusy(false);
        if (value.selected || value.text.trim().length < 2)
            return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setBusy(true);
            api<{
                places: Place[];
            }>(`/places/search?q=${encodeURIComponent(value.text.trim())}`, { signal: controller.signal })
                .then(result => { if (!controller.signal.aborted) {
                setPlaces(result.places);
                setOpen(true);
            } })
                .catch(error => { if (!controller.signal.aborted)
                setError(errorMessage(error)); })
                .finally(() => { if (!controller.signal.aborted)
                setBusy(false); });
        }, 280);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [value.text, value.selected]);
    function choose(place: Place) { onChange({ id: value.id, text: place.name, selected: { id: value.id, label: place.name, lat: place.lat, lng: place.lng, address: place.address } }); setOpen(false); input.current?.focus(); }
    return <div className="origin-wrap">
    <div className={`origin-field ${value.selected ? 'is-selected' : ''}`}>
      <span className="person-number" aria-hidden="true">{index + 1}</span>
      <div className="input-stack"><label htmlFor={value.id}>참가자 {index + 1} 출발지</label>
        <input ref={input} id={value.id} role="combobox" aria-autocomplete="list" aria-expanded={open && places.length > 0} aria-controls={`${value.id}-options`} aria-activedescendant={active >= 0 ? `${value.id}-option-${active}` : undefined} autoComplete="off" placeholder="주소, 역 또는 장소 검색" value={value.text} disabled={disabled} onChange={event => { onChange({ id: value.id, text: event.target.value }); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={event => { if (event.key === 'Escape')
        setOpen(false); if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
        setActive(current => Math.max(0, Math.min(places.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))));
    } if (event.key === 'Enter' && open && active >= 0 && places[active]) {
        event.preventDefault();
        choose(places[active]);
    } }}/>
      </div>
      {value.selected && <span className="selected-check" aria-label="선택 완료">✓</span>}
      {onRemove && <button className="icon-button" type="button" disabled={disabled} aria-label={`참가자 ${index + 1} 삭제`} onClick={onRemove}>×</button>}
    </div>
    {value.selected && <p className="selected-address">{value.selected.address || '출발지를 선택했어요'}</p>}
    {busy && <p className="input-hint" role="status">장소를 찾고 있어요…</p>}
    {error && <p className="error-text" role="alert">{error}</p>}
    {open && places.length > 0 && <ul className="suggestions" role="listbox" id={`${value.id}-options`} aria-label={`참가자 ${index + 1} 검색 결과`}>
      {places.map((place, placeIndex) => <li key={place.id} role="option" id={`${value.id}-option-${placeIndex}`} aria-selected={active === placeIndex} onMouseDown={event => event.preventDefault()} onClick={() => choose(place)}><span className="place-symbol" aria-hidden="true">↗</span><span><strong>{place.name}</strong><small>{place.address}</small></span></li>)}
    </ul>}
    {!busy && !error && open && value.text.trim().length >= 2 && !value.selected && places.length === 0 && <p className="input-hint">검색 결과가 없으면 더 자세한 장소명을 입력해 주세요.</p>}
  </div>;
}
