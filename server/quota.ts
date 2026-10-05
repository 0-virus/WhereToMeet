import { ApiFailure } from './errors.ts';
export type QuotaLimits={hitsPerMinute:number;maxConcurrent:number;hitsPerSearch:number};
export async function reserveQuota(db:D1Database,id:string,owner:string,limits:QuotaLimits,now:number) {
 if(Object.values(limits).some(x=>!Number.isSafeInteger(x)||x<=0)||limits.hitsPerSearch>limits.hitsPerMinute)throw new ApiFailure('CONFIG_NOT_READY',503);
 // One SQLite write statement serializes the checks and insertion across isolates.
 // Keep the FULL reservation for 90 seconds: 30s request + 60s rolling provider window.
 // Keep the owner lease too: pending history cleanup can outlive the response
 // by 30s. Releasing it after cleanup still permits immediate normal reuse.
 let row;
 try {row=await db.prepare(`INSERT INTO quota_reservations(request_id,owner_hash,reserved_hits,active_until,expires_at)
 SELECT ?,?,?,?,? WHERE
 (SELECT count(*) FROM quota_reservations WHERE active_until>?) < ? AND
 NOT EXISTS(SELECT 1 FROM quota_reservations WHERE owner_hash=? AND active_until>?) AND
 COALESCE((SELECT sum(reserved_hits) FROM quota_reservations WHERE expires_at>?),0)+? <= ?
 RETURNING request_id`).bind(id,owner,limits.hitsPerSearch,now+90000,now+90000,now,limits.maxConcurrent,owner,now,now,limits.hitsPerSearch,limits.hitsPerMinute).first();}
 catch {throw new ApiFailure('QUOTA_UNAVAILABLE',503);}
 if(!row)throw new ApiFailure('QUOTA_EXCEEDED',429);
 let spent=0;
 return {beforeRequest:async(hits:number)=>{if(!Number.isInteger(hits)||hits<=0||spent+hits>limits.hitsPerSearch)throw new ApiFailure('QUOTA_EXCEEDED',429);spent+=hits;},
 release:async()=>{await db.prepare('UPDATE quota_reservations SET active_until=0 WHERE request_id=?').bind(id).run();}};
}
