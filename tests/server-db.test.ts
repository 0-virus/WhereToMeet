import test from 'node:test';
import assert from 'node:assert/strict';
import { testDb } from './d1-test-helper.ts';
import { saveHistory, listHistory, getHistory, setBookmarks, deleteHistory } from '../server/history.ts';
import { recordSearchEvent, deleteExpiredSearchEvents } from '../server/search-events.ts';
import { reserveQuota } from '../server/quota.ts';
const now = Date.parse('2026-10-05T10:00:00Z');
const input = { origins: [{id:'a',label:'A',lat:37.5,lng:127},{id:'b',label:'B',lat:37.6,lng:127}], meetingAt:'2026-10-06T10:00:00Z' };
test('history ownership, bookmarks retained on update and expiration boundary', async () => {
 const {db} = testDb(); const old = now - 91 * 86400000;
 const id = await saveHistory(db,'owner',input,old);
 assert.equal(await getHistory(db,'other',id,old),null);
 assert.equal(await setBookmarks(db,'other',id,['h1'],old),null);
 await setBookmarks(db,'owner',id,['h1'],old);
 assert.equal((await listHistory(db,'owner',now)).length,1);
 await saveHistory(db,'owner',{...input,historyId:id},old);
 assert.deepEqual((await getHistory(db,'owner',id,now))?.bookmarkedHubIds,['h1']);
 assert.equal(await setBookmarks(db,'owner',id,[],now),null);
 assert.equal((await listHistory(db,'owner',now)).length,0);
 const current = await saveHistory(db,'owner',input,now);
 await deleteHistory(db,'other',current);
 assert.ok(await getHistory(db,'owner',current,now));
 await deleteHistory(db,'owner'); assert.equal((await listHistory(db,'owner',now)).length,0);
});
test('statistics allowlist, dedup, SQL constraints and exact retention boundary', async () => {
 const {db,sqlite} = testDb();
 const event = {requestId:'id',searchedAt:new Date(now).toISOString(),participantCount:2,status:'success' as const,errorCode:null,recommendedHubIds:['h1'],traveltimeHits:7,durationMs:12,algorithmVersion:'v1',dataVersion:'v1',origins:input.origins};
 await recordSearchEvent(db,event); await recordSearchEvent(db,event);
 const rows=sqlite.prepare('SELECT * FROM search_events').all(); assert.equal(rows.length,1);
 assert.equal(JSON.stringify(rows).includes('37.5'),false);
 await assert.rejects(recordSearchEvent(db,{...event,requestId:'invalid',participantCount:5}));
 await assert.rejects(recordSearchEvent(db,{...event,requestId:'five',recommendedHubIds:['1','2','3','4','5']}));
 await deleteExpiredSearchEvents(db,event.searchedAt); assert.equal(sqlite.prepare('SELECT count(*) n FROM search_events').get()?.n,1);
 await deleteExpiredSearchEvents(db,new Date(now+1).toISOString()); assert.equal(sqlite.prepare('SELECT count(*) n FROM search_events').get()?.n,0);
});
test('D1 quota enforces global concurrency, rolling budget, dedup and lease recovery', async () => {
 const {db}=testDb(); const limits={hitsPerMinute:120,maxConcurrent:1,hitsPerSearch:60};
 const first=await reserveQuota(db,'r1','owner',limits,now);
 await assert.rejects(reserveQuota(db,'r2','other',limits,now));
 await first.release(); const second=await reserveQuota(db,'r2','other',limits,now);
 await second.release(); await assert.rejects(reserveQuota(db,'r3','other',limits,now));
 const third=await reserveQuota(db,'r3','owner',limits,now+91001);
 await third.release();
});
test('owner lease covers delayed cancellation cleanup and then recovers',async()=>{
 const {db}=testDb();const limits={hitsPerMinute:10000,maxConcurrent:10,hitsPerSearch:60};
 await reserveQuota(db,'pending','owner',limits,now);
 for(const elapsed of [36000,60000,89999])await assert.rejects(reserveQuota(db,`overlap-${elapsed}`,'owner',limits,now+elapsed));
 const recovered=await reserveQuota(db,'recovered','owner',limits,now+90000);
 await recovered.release();
 await reserveQuota(db,'after-cleanup','owner',limits,now+90001);
});
test('bookmarks from different successful searches can exceed four',async()=>{
 const {db}=testDb();const id=await saveHistory(db,'owner',input,now);
 const hubIds=['a','b','c','d','e'];await setBookmarks(db,'owner',id,hubIds,now);
 await saveHistory(db,'owner',{...input,historyId:id},now+1);
 assert.deepEqual((await getHistory(db,'owner',id,now+1))?.bookmarkedHubIds,hubIds);
});
