import type { HistoryRecord, RecommendRequest } from '../src/shared.ts';
const retention=90*86400000;
type Row={id:string;origins_json:string;meeting_at:string;searched_at:string;bookmarked_hub_ids_json:string;write_revision:string};
function record(row:Row):HistoryRecord {return {id:row.id,origins:JSON.parse(row.origins_json),meetingAt:row.meeting_at,searchedAt:row.searched_at,bookmarkedHubIds:JSON.parse(row.bookmarked_hub_ids_json)};}
const alive="(searched_at >= ? OR json_array_length(bookmarked_hub_ids_json)>0)";
export async function listHistory(db:D1Database,owner:string,now:number):Promise<HistoryRecord[]> {
 const rows=await db.prepare(`SELECT * FROM history WHERE owner_hash=? AND ${alive} ORDER BY (json_array_length(bookmarked_hub_ids_json)>0) DESC,searched_at DESC,id DESC`).bind(owner,new Date(now-retention).toISOString()).all<Row>();
 return rows.results.map(record);
}
export async function getHistory(db:D1Database,owner:string,id:string,now:number):Promise<HistoryRecord|null> {
 const row=await db.prepare(`SELECT * FROM history WHERE owner_hash=? AND id=? AND ${alive}`).bind(owner,id,new Date(now-retention).toISOString()).first<Row>(); return row?record(row):null;
}
export class HistoryRollbackError extends Error {
 constructor(){super('HISTORY_ROLLBACK_FAILED');}
}
export async function saveHistory(db:D1Database,owner:string,input:RecommendRequest,now:number,signal?:AbortSignal):Promise<string> {
 const id=input.historyId??crypto.randomUUID();
 const revision=crypto.randomUUID();
 const origins=input.origins.map(({id,label,lat,lng,address})=>({id,label,lat,lng,...(address?{address}:{})}));
 let previous:Row|null=null;
 let attempted=false;
 try {
  signal?.throwIfAborted();
  if(input.historyId) {
   let updated=false;
   for(let attempt=0;attempt<3;attempt++) {
    previous=await db.prepare('SELECT * FROM history WHERE id=? AND owner_hash=?').bind(id,owner).first<Row>();
    if(!previous)throw new Error('HISTORY_MISSING');
    signal?.throwIfAborted();
    attempted=true;
    const result=await db.prepare('UPDATE history SET origins_json=?,meeting_at=?,searched_at=?,write_revision=? WHERE id=? AND owner_hash=? AND write_revision=?').bind(JSON.stringify(origins),input.meetingAt,new Date(now).toISOString(),revision,id,owner,previous.write_revision).run();
    if(result.meta.changes){updated=true;break;}
    attempted=false;
    signal?.throwIfAborted();
   }
   if(!updated)throw new Error('HISTORY_WRITE_CONFLICT');
  } else {
   attempted=true;
   await db.prepare('INSERT INTO history(id,owner_hash,origins_json,meeting_at,searched_at,write_revision) VALUES(?,?,?,?,?,?)').bind(id,owner,JSON.stringify(origins),input.meetingAt,new Date(now).toISOString(),revision).run();
  }
  signal?.throwIfAborted();
  return id;
 } catch(error) {
  if(attempted) {
   // D1 cannot cancel an already dispatched write. Undo only this exact write,
   // including ambiguous database failures, never a later successful revision.
   try {
    if(previous)await db.prepare('UPDATE history SET origins_json=?,meeting_at=?,searched_at=?,write_revision=? WHERE id=? AND owner_hash=? AND write_revision=?').bind(previous.origins_json,previous.meeting_at,previous.searched_at,previous.write_revision,id,owner,revision).run();
    else await db.prepare('DELETE FROM history WHERE id=? AND owner_hash=? AND write_revision=?').bind(id,owner,revision).run();
   } catch {throw new HistoryRollbackError();}
  }
  throw error;
 }
}
export async function setBookmarks(db:D1Database,owner:string,id:string,hubIds:string[],now:number):Promise<HistoryRecord|null> {
 const current=await getHistory(db,owner,id,now); if(!current)return null;
 await db.prepare('UPDATE history SET bookmarked_hub_ids_json=? WHERE owner_hash=? AND id=?').bind(JSON.stringify(hubIds),owner,id).run();
 // Evaluate current expiry and pins in the DELETE itself. A refresh or pin that
 // committed after the original read must survive this last-unpin operation.
 if(hubIds.length===0)await db.prepare('DELETE FROM history WHERE owner_hash=? AND id=? AND searched_at < ? AND json_array_length(bookmarked_hub_ids_json)=0').bind(owner,id,new Date(now-retention).toISOString()).run();
 return getHistory(db,owner,id,now);
}
export async function deleteHistory(db:D1Database,owner:string,id?:string):Promise<void> {
 await (id?db.prepare('DELETE FROM history WHERE owner_hash=? AND id=?').bind(owner,id):db.prepare('DELETE FROM history WHERE owner_hash=?').bind(owner)).run();
}
export async function deleteExpiredHistory(db:D1Database,now:number):Promise<void> {await db.prepare("DELETE FROM history WHERE searched_at < ? AND json_array_length(bookmarked_hub_ids_json)=0").bind(new Date(now-retention).toISOString()).run();}
export async function anonymousIdentity(request:Request):Promise<{owner:string;cookie?:string}> {
 const existing=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-wtm='))?.slice(11);
 const valid=existing && /^[a-f0-9]{64}$/.test(existing);
 const token=valid?existing:Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
 const owner=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
 return {owner,cookie:`__Host-wtm=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`};
}
