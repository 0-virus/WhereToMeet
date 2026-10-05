import test from 'node:test';
import assert from 'node:assert/strict';
import { testDb } from './d1-test-helper.ts';
import { anonymousIdentity, getHistory, HistoryRollbackError, saveHistory, setBookmarks } from '../server/history.ts';
import { createWorker } from '../server/app.ts';
import type { Catalog } from '../src/shared.ts';

const now=Date.parse('2026-10-05T10:00:00Z');
const input={origins:[{id:'a',label:'A',lat:37.5,lng:127},{id:'b',label:'B',lat:37.6,lng:127}],meetingAt:'2026-10-06T10:00:00Z'};
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}
function gateDb(db:D1Database,match:(sql:string,method:string)=>boolean,after=false){
 const entered=deferred(),release=deferred();let held=false;
 const prepare=(sql:string,statement:D1PreparedStatement):D1PreparedStatement=>new Proxy(statement,{get(target,property){
  if(property==='bind')return (...values:unknown[])=>prepare(sql,target.bind(...values));
  if(['run','first','all'].includes(String(property)))return async()=>{
   const method=String(property) as 'run';
   if(!held&&match(sql,method)){held=true;const result=after?await target[method]():undefined;entered.resolve();await release.promise;return after?result:target[method]();}
   return target[method]();
  };return Reflect.get(target,property);
 }});
 return {db:{prepare:(sql:string)=>prepare(sql,db.prepare(sql))} as D1Database,entered:entered.promise,release:release.resolve};
}
test('abort during INSERT awaits tracked cleanup and leaves no new history',async()=>{
 const {db,sqlite}=testDb();const gate=gateDb(db,(sql,method)=>method==='run'&&sql.startsWith('INSERT INTO history('));
 const catalog:Catalog={version:'test',generatedAt:new Date(now).toISOString(),hubs:[{id:'h',name:'Hub',lat:37.5,lng:127,regionCode:'11',kind:'rail',sourceId:'test',sourceUrl:'https://example.org',sourceDate:'2026-10-05',verified:true}]};
 const worker=createWorker({catalog,now:()=>now,fetchImpl:(async()=>Response.json({documents:[{region_type:'B',code:'1168000000'}]})) as typeof fetch,recommendImpl:async()=>[]});
 const env={DB:gate.db,ROUTING_APPROVED:'true',KAKAO_REST_API_KEY:'key',TRAVELTIME_APP_ID:'key',TRAVELTIME_API_KEY:'key',TRAVELTIME_HITS_PER_MINUTE:'120',TRAVELTIME_HITS_PER_SEARCH:'60',MAX_CONCURRENT_SEARCHES:'1'};
 const background:Promise<unknown>[]=[];const controller=new AbortController();
 const response=worker.fetch(new Request('https://app.test/api/recommendations',{method:'POST',headers:{origin:'https://app.test','content-type':'application/json'},body:JSON.stringify(input),signal:controller.signal}),env,{waitUntil:p=>background.push(p)});
 await gate.entered;controller.abort();assert.equal((await response).status,499);gate.release();
 await Promise.all(background);await new Promise(done=>setImmediate(done));
 assert.equal(sqlite.prepare('SELECT count(*) n FROM history').get()?.n,0);
 assert.equal(sqlite.prepare('SELECT status FROM search_events').get()?.status,'cancelled');
});
test('canceled refresh restores prior inputs and time while preserving concurrent bookmarks',async()=>{
 const {db}=testDb();const id=await saveHistory(db,'owner',input,now);const previous=await getHistory(db,'owner',id,now);
 const gate=gateDb(db,(sql,method)=>method==='run'&&sql.startsWith('UPDATE history SET origins_json='),true);const controller=new AbortController();
 const saving=saveHistory(gate.db,'owner',{...input,historyId:id,meetingAt:'2026-10-07T10:00:00Z'},now+1,controller.signal);
 await gate.entered;await setBookmarks(db,'owner',id,['new-pin'],now+2);controller.abort();gate.release();await assert.rejects(saving);
 const restored=await getHistory(db,'owner',id,now+2);assert.equal(restored?.meetingAt,previous?.meetingAt);assert.equal(restored?.searchedAt,previous?.searchedAt);assert.deepEqual(restored?.bookmarkedHubIds,['new-pin']);
});
test('cancel compensation never erases a later successful refresh',async()=>{
 const {db}=testDb();const id=await saveHistory(db,'owner',input,now);
 const gate=gateDb(db,(sql,method)=>method==='run'&&sql.startsWith('UPDATE history SET origins_json='),true);const controller=new AbortController();
 const saving=saveHistory(gate.db,'owner',{...input,historyId:id,meetingAt:'2026-10-07T10:00:00Z'},now+1,controller.signal);
 await gate.entered;await saveHistory(db,'owner',{...input,historyId:id,meetingAt:'2026-10-08T10:00:00Z'},now+2);controller.abort();gate.release();await assert.rejects(saving);
 assert.equal((await getHistory(db,'owner',id,now+2))?.meetingAt,'2026-10-08T10:00:00Z');
});
test('last-unpin cannot delete a record refreshed after its old expiry was read',async()=>{
 const {db}=testDb();const old=now-91*86400000;const id=await saveHistory(db,'owner',input,old);await setBookmarks(db,'owner',id,['pin'],old);
 const gate=gateDb(db,(sql,method)=>method==='first'&&sql.startsWith('SELECT * FROM history'),true);
 const unpin=setBookmarks(gate.db,'owner',id,[],now);await gate.entered;await saveHistory(db,'owner',{...input,historyId:id},now);gate.release();await unpin;
 const record=await getHistory(db,'owner',id,now);assert.ok(record);assert.deepEqual(record.bookmarkedHubIds,[]);
});
test('existing anonymous cookie is renewed without changing token',async()=>{
 const token='ab'.repeat(32);const identity=await anonymousIdentity(new Request('https://app.test',{headers:{cookie:`__Host-wtm=${token}`}}));
 assert.equal(identity.cookie,`__Host-wtm=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`);
});
test('canceling an INSERT cannot delete a later successful search on that row',async()=>{
 const {db,sqlite}=testDb();const gate=gateDb(db,(sql,method)=>method==='run'&&sql.startsWith('INSERT INTO history('),true);const controller=new AbortController();
 const saving=saveHistory(gate.db,'owner',input,now,controller.signal);await gate.entered;
 const id=sqlite.prepare('SELECT id FROM history').get()!.id as string;
 await saveHistory(db,'owner',{...input,historyId:id,meetingAt:'2026-10-08T10:00:00Z'},now+2);
 controller.abort();gate.release();await assert.rejects(saving);
 assert.equal((await getHistory(db,'owner',id,now+2))?.meetingAt,'2026-10-08T10:00:00Z');
});
test('a concurrent new bookmark prevents expired last-unpin deletion',async()=>{
 const {db}=testDb();const old=now-91*86400000;const id=await saveHistory(db,'owner',input,old);await setBookmarks(db,'owner',id,['pin'],old);
 const gate=gateDb(db,(sql,method)=>method==='run'&&sql.startsWith('DELETE FROM history'));
 const unpin=setBookmarks(gate.db,'owner',id,[],now);await gate.entered;
 await db.prepare('UPDATE history SET bookmarked_hub_ids_json=? WHERE id=?').bind('["new-pin"]',id).run();
 gate.release();await unpin;assert.deepEqual((await getHistory(db,'owner',id,now))?.bookmarkedHubIds,['new-pin']);
});
test('database rollback failure is distinguishable from successful cancellation cleanup',async()=>{
 const {db}=testDb();const controller=new AbortController();
 const broken={prepare:(sql:string)=>{
  const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>new Proxy(statement,{get(target,property){
   if(property==='bind')return (...values:unknown[])=>wrap(target.bind(...values));
   if(property==='run')return async()=>{
    if(sql.startsWith('DELETE FROM history'))throw new Error('private database details');
    const result=await target.run();if(sql.startsWith('INSERT INTO history('))controller.abort();return result;
   };return Reflect.get(target,property);
  }});return wrap(db.prepare(sql));
 }} as D1Database;
 await assert.rejects(saveHistory(broken,'owner',input,now,controller.signal),error=>error instanceof HistoryRollbackError&&error.message==='HISTORY_ROLLBACK_FAILED');
});
