import { useEffect, useState } from 'react';
import type { HistoryRecord } from './shared';
import { api, errorMessage, timeKst } from './api';
export function History({ refresh, onRestore }: {
    refresh: number;
    onRestore: (id: string) => Promise<void>;
}) {
    const [records, setRecords] = useState<HistoryRecord[]>([]);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [pending, setPending] = useState('');
    const [confirm, setConfirm] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    useEffect(() => { const controller = new AbortController(); setBusy(true); setError(''); api<{
        history: HistoryRecord[];
    }>('/history', { signal: controller.signal }).then(value => { if (!controller.signal.aborted)
        setRecords(value.history); }).catch(error => { if (!controller.signal.aborted)
        setError(errorMessage(error)); }).finally(() => { if (!controller.signal.aborted)
        setBusy(false); }); return () => controller.abort(); }, [refresh, revision]);
    async function remove(id: string) { setPending(id); setError(''); try {
        await api(`/history${id === 'all' ? '' : `/${encodeURIComponent(id)}`}`, { method: 'DELETE' });
        setRecords(items => id === 'all' ? [] : items.filter(item => item.id !== id));
        setConfirm(null);
    }
    catch (error) {
        setError(errorMessage(error));
    }
    finally {
        setPending('');
    } }
    async function unbookmark(record: HistoryRecord, hubId: string) { setPending(record.id); setError(''); try {
        const value = await api<{
            record: HistoryRecord | null;
        }>(`/history/${encodeURIComponent(record.id)}/bookmarks`, { method: 'PATCH', body: JSON.stringify({ hubIds: record.bookmarkedHubIds.filter(id => id !== hubId) }) });
        setRecords(items => items.flatMap(item => item.id === record.id ? value.record ? [value.record] : [] : [item]));
    }
    catch (error) {
        setError(errorMessage(error));
    }
    finally {
        setPending('');
    } }
    const sorted = [...records].sort((a, b) => Number(b.bookmarkedHubIds.length > 0) - Number(a.bookmarkedHubIds.length > 0) || Date.parse(b.searchedAt) - Date.parse(a.searchedAt));
    return <section className="history-section"><div className="section-heading"><div><span className="eyebrow">이 브라우저에 이어지는 만남</span><h1>내 기록</h1><p>기록을 다시 열면 최신 교통 정보로 검색해요.</p></div>{records.length > 0 && <button className="text-button" disabled={!!pending} onClick={() => setConfirm('all')}>전체 삭제</button>}</div>
    <p className="history-policy">최근 검색은 90일 동안, 즐겨찾기가 있는 기록은 직접 삭제할 때까지 보관해요. 다른 기기에서는 보이지 않아요.</p>
    {busy && <p role="status">기록을 불러오고 있어요…</p>}{error && <div role="alert" className="notice error">{error}<button className="text-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div>}
    {!busy && !error && records.length === 0 && <div className="empty-state"><span className="empty-icon" aria-hidden="true">♡</span><h2>다음 만남을 위한 작은 기록</h2><p>만날 곳을 검색하면 여기에 모아드려요.<br />마음에 드는 거점은 즐겨찾기로 남겨보세요.</p></div>}
    {confirm && <div className="notice delete-confirm" role="alert"><strong>{confirm === 'all' ? '모든 검색 기록과 즐겨찾기를 삭제할까요?' : '이 검색 기록과 즐겨찾기를 삭제할까요?'}</strong><p>삭제한 기록은 복구할 수 없어요.</p><div className="button-row"><button className="primary" disabled={!!pending} onClick={() => void remove(confirm)}>삭제하기</button><button className="secondary" disabled={!!pending} onClick={() => setConfirm(null)}>취소</button></div></div>}
    <div className="history-list">{sorted.map(record => <article className="history-card" key={record.id}><div className="card-heading"><div>{record.bookmarkedHubIds.length > 0 && <span className="badge">♥ 즐겨찾기</span>}<h2>{record.origins.map(origin => origin.label).join(' · ')}</h2><p>{timeKst(record.meetingAt)} 약속 · {record.origins.length}명</p></div></div>
      {record.bookmarkedHubIds.length > 0 && <div className="saved-hubs" aria-label="저장한 만날 곳">{record.bookmarkedHubIds.map(id => <div className="saved-hub" key={id}><a href={`/meet/${encodeURIComponent(id)}`}>{record.bookmarkedHubs?.find(hub => hub.id === id)?.name || '저장한 거점 보기'} ↗</a><button className="icon-button" aria-label={`${record.bookmarkedHubs?.find(hub => hub.id === id)?.name || '거점'} 즐겨찾기 해제`} disabled={!!pending} onClick={() => void unbookmark(record, id)}>×</button></div>)}</div>}
      <div className="history-actions"><button className="secondary" disabled={!!pending} onClick={async () => { setPending(record.id); try {
            await onRestore(record.id);
        }
        finally {
            setPending('');
        } }}>다시 검색</button><button className="text-button" disabled={!!pending} onClick={() => setConfirm(record.id)}>기록 삭제</button><small>{timeKst(record.searchedAt)} 검색</small></div>
    </article>)}</div>
  </section>;
}
