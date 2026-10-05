export type SearchEvent={requestId:string;searchedAt:string;participantCount:number;status:'success'|'no_routes'|'error'|'cancelled';errorCode:string|null;recommendedHubIds:string[];traveltimeHits:number;durationMs:number;algorithmVersion:string;dataVersion:string};
const errorCodes=new Set(['QUOTA_EXCEEDED','QUOTA_UNAVAILABLE','PROVIDER_ERROR','PROVIDER_UNAVAILABLE','TIMEOUT','CANCELLED','INTERNAL_ERROR']);
export async function recordSearchEvent(db:D1Database,event:SearchEvent):Promise<void> {
 if(event.recommendedHubIds.length>4 || event.recommendedHubIds.some(x=>typeof x!=='string'||x.length>100))throw new Error('INVALID_EVENT');
 const error=event.errorCode===null?null:errorCodes.has(event.errorCode)?event.errorCode:'INTERNAL_ERROR';
 await db.prepare(`INSERT INTO search_events(request_id,searched_at,participant_count,status,error_code,recommended_hub_ids_json,traveltime_hits,duration_ms,algorithm_version,data_version) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING`).bind(event.requestId,event.searchedAt,event.participantCount,event.status,error,JSON.stringify(event.recommendedHubIds),event.traveltimeHits,event.durationMs,event.algorithmVersion,event.dataVersion).run();
}
export async function deleteExpiredSearchEvents(db:D1Database,cutoffIso:string):Promise<void> {await db.prepare('DELETE FROM search_events WHERE searched_at < ?').bind(cutoffIso).run();}
export function queueSearchEvent(ctx:Pick<ExecutionContext,'waitUntil'>,db:D1Database,event:SearchEvent) {
 // ponytail: 검색 통계 누락 가능, 무손실 수집이 필요해지면 Queue 도입
 ctx.waitUntil(recordSearchEvent(db,event).catch(()=>{console.warn(JSON.stringify({code:'SEARCH_EVENT_WRITE_FAILED',requestId:event.requestId}));}));
}
