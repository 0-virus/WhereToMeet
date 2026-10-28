import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../server/app.ts';
import { testDb } from './d1-test-helper.ts';
import { validateRecommendation } from '../server/validation.ts';
import { kakaoPlaces, verifyRegions } from '../server/kakao.ts';
import type { Catalog } from '../src/shared.ts';
const now=Date.parse('2026-10-05T10:00:00Z');
const input={origins:[{id:'a',label:'A',lat:37.5,lng:127},{id:'b',label:'B',lat:37.6,lng:127}],meetingAt:'2026-10-06T10:00:00Z'};
const catalog:Catalog={version:'test',generatedAt:new Date(now).toISOString(),hubs:[{id:'h1',name:'Hub',lat:37.5,lng:127,regionCode:'11',kind:'rail',sourceId:'test',sourceUrl:'https://example.org',sourceDate:'2026-10-05',verified:true}]};
function fixture(overrides:any={}) {
 const {db,sqlite}=testDb();const background:Promise<unknown>[]=[];
 const env={DB:db,ROUTING_APPROVED:'true',KAKAO_REST_API_KEY:'secret',TRAVELTIME_APP_ID:'secret',TRAVELTIME_API_KEY:'secret',TRAVELTIME_HITS_PER_MINUTE:'120',TRAVELTIME_HITS_PER_SEARCH:'60',MAX_CONCURRENT_SEARCHES:'1'};
 const worker=createWorker({catalog,now:()=>now,fetchImpl:async()=>Response.json({documents:[{region_type:'B',code:'1168000000'}]}) as any,recommendImpl:async()=>[],...overrides});
 const ctx={waitUntil:(p:Promise<unknown>)=>background.push(p)};
 const send=(path:string,method='GET',body?:unknown,cookie?:string,origin='https://app.test')=>worker.fetch(new Request(`https://app.test${path}`,{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,ctx);
 return {send,env,sqlite,background};
}
test('validation rejects count, IDs, nonfinite coordinates, date overflow/timezone and seven-day range',()=>{
 for(const value of [{...input,origins:input.origins.slice(0,1)},{...input,origins:[input.origins[0],input.origins[0]]},{...input,origins:[{...input.origins[0],lat:NaN},input.origins[1]]},{...input,meetingAt:'2026-10-06T10:00:00'},{...input,meetingAt:'2026-11-31T10:00:00Z'},{...input,meetingAt:new Date(now+7*86400000+1).toISOString()}]) assert.throws(()=>validateRecommendation(value,now));
 assert.equal(validateRecommendation(input,now).origins.length,2);
});
test('actual API saves history, strict owner authorization before provider, bookmarks and deletion',async()=>{
 let calls=0;const f=fixture({recommendImpl:async()=>{calls++;return [];}});
 const result=await f.send('/api/recommendations','POST',input);assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
 const cookie=result.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 const body=await result.json() as any;assert.equal(body.status,'no_routes');assert.equal(body.historySaved,true);
 const denied=await f.send('/api/recommendations','POST',{...input,historyId:body.historyId});assert.equal(denied.status,404);assert.equal(calls,1);
 assert.deepEqual((await (await f.send('/api/history')).json() as any).history,[]);
 const pin=await f.send(`/api/history/${body.historyId}/bookmarks`,'PATCH',{hubIds:['h1']},cookie);assert.equal(pin.status,200);
 assert.equal((await (await f.send('/api/history','GET',undefined,cookie)).json() as any).history.length,1);
 assert.equal((await f.send(`/api/history/${body.historyId}`,'DELETE',undefined,cookie,'https://evil.test')).status,403);
 assert.equal((await f.send('/api/history','DELETE',undefined,cookie)).status,204);
 await Promise.all(f.background);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM search_events').get()?.n,1);
});
test('catalog/routing fail closed, invalid inputs never enter telemetry, provider error has no private details',async()=>{
 assert.equal((await fixture({catalog:{...catalog,hubs:[]}}).send('/api/recommendations','POST',input)).status,503);
 const disabled=fixture();disabled.env.ROUTING_APPROVED='false';assert.equal((await disabled.send('/api/recommendations','POST',input)).status,503);
 const f=fixture({recommendImpl:async()=>{throw new Error('secret lat=37.5 address private');}});
 assert.equal((await f.send('/api/recommendations','POST',{})).status,400);
 const response=await f.send('/api/recommendations','POST',input);assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/secret|37.5|private/);
 await Promise.all(f.background);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM search_events').get()?.n,1);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM history').get()?.n,0);
});
test('history write failure preserves no_routes with visible warning and telemetry failure isolation',async()=>{
 const f=fixture({recommendImpl:async()=>{f.sqlite.exec('DROP TABLE history; DROP TABLE search_events');return [];}});
 const response=await f.send('/api/recommendations','POST',input);const body=await response.json() as any;
 assert.equal(response.status,200);assert.equal(body.historySaved,false);assert.ok(body.warning);await Promise.all(f.background);
});
test('one overall deadline cancels provider, never saves history',async()=>{
 const f=fixture({budgetMs:10,recommendImpl:async()=>new Promise(()=>{})});
 const response=await f.send('/api/recommendations','POST',input);assert.equal(response.status,504);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM history').get()?.n,0);await Promise.all(f.background);
});
test('client abort is distinct from timeout and no history persists',async()=>{
 const f=fixture();const controller=new AbortController();controller.abort();
 const worker=createWorker({catalog,now:()=>now,recommendImpl:async()=>{assert.fail('must not run');}});
 const response=await worker.fetch(new Request('https://app.test/api/recommendations',{method:'POST',headers:{origin:'https://app.test','content-type':'application/json'},body:JSON.stringify(input),signal:controller.signal}),f.env,{waitUntil:()=>{}});
 assert.equal(response.status,499);assert.equal((await response.json() as any).error.code,'CANCELLED');
});
test('provider rate limit/timeout keep intended safe HTTP semantics',async()=>{
 for(const [code,status] of [['provider_rate_limited',429],['routing_timeout',504],['provider_rejected',502],['routing_budget_exceeded',503]] as const){
  const f=fixture({recommendImpl:async()=>{throw Object.assign(new Error('secret'),{code,status});}});
  const response=await f.send('/api/recommendations','POST',input);assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/secret/);await Promise.all(f.background);
 }
});
test('Kakao uses fixed endpoints and normalizes trusted link, region fails closed',async()=>{
 const urls:string[]=[];const fetchImpl=async(url:any)=>{urls.push(String(url));return Response.json({documents:[{id:'12',place_name:'Cafe',x:'127',y:'37.5',address_name:'서울 강남구',place_url:'http://place.map.kakao.com/12'},{id:'13',place_name:'bad',x:'127',y:'37.5',place_url:'javascript:alert(1)'}]});};
 const places=await kakaoPlaces('search',{q:'강남역'},'key',new AbortController().signal,fetchImpl as any);assert.equal(places.length,1);assert.equal(places[0].url,'https://place.map.kakao.com/12');assert.ok(urls[0].startsWith('https://dapi.kakao.com/v2/local/search/keyword.json?'));
 await assert.rejects(verifyRegions(input.origins,'key',new AbortController().signal,(async()=>Response.json({documents:[{region_type:'B',code:'2611000000'}]})) as any));
});
test('Kakao retries transient failure once respecting Retry-After and deadline',async()=>{
 let calls=0;const fetchImpl=(async()=>{calls++;return calls===1?new Response(null,{status:429,headers:{'retry-after':'0.001'}}):Response.json({documents:[]});}) as typeof fetch;
 assert.deepEqual(await kakaoPlaces('search',{q:'강남'},'key',new AbortController().signal,fetchImpl,Date.now()+1000),[]);assert.equal(calls,2);
 calls=0;await assert.rejects(kakaoPlaces('search',{q:'강남'},'key',new AbortController().signal,(async()=>{calls++;return new Response(null,{status:429,headers:{'retry-after':'60'}});}) as typeof fetch,Date.now()+100));assert.equal(calls,1);
});
test('production external calls require limiter and never disclose raw IP to its key',async()=>{
 const f=fixture();const worker=createWorker({catalog,fetchImpl:(async()=>Response.json({documents:[]})) as typeof fetch});
 const request=new Request('https://app.test/api/places/search?q=hello',{headers:{'CF-Connecting-IP':'192.0.2.12'}});
 assert.equal((await worker.fetch(request,{...f.env,ENVIRONMENT:'production'},{waitUntil:()=>{}})).status,503);
 const response=await worker.fetch(request,{...f.env,ENVIRONMENT:'production',RATE_LIMITER:{limit:async({key})=>{assert.match(key,/^[a-f0-9]{64}$/);assert.doesNotMatch(key,/192\.0/);return {success:true};}}},{waitUntil:()=>{}});assert.equal(response.status,200);
});

test('omitted provider participant returns 502 without saving no_routes history',async()=>{
 const f=fixture({recommendImpl:undefined,fetchImpl:async(url:RequestInfo|URL,init?:RequestInit)=>{
  const address=String(url);
  if(address.startsWith('https://dapi.kakao.com/'))return Response.json({documents:[{region_type:'B',code:'1168000000'}]});
  const body=JSON.parse(String(init?.body));
  if(address==='https://api.traveltimeapp.com/v4/time-map')return Response.json({results:body.departure_searches.map((s:{id:string})=>({search_id:s.id,shapes:[{shell:[{lat:37,lng:126},{lat:38,lng:126},{lat:38,lng:128},{lat:37,lng:128}],holes:[]}]}))});
  assert.equal(address,'https://api.traveltimeapp.com/v4/time-filter');
  return Response.json({results:body.arrival_searches.map((s:{id:string})=>({search_id:s.id,locations:[],unreachable:[]}))});
 }});
 const response=await f.send('/api/recommendations','POST',input);
 assert.equal(response.status,502);assert.equal((await response.json() as any).error.code,'PROVIDER_ERROR');
 await Promise.all(f.background);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM history').get()?.n,0);
 const event=f.sqlite.prepare('SELECT status,error_code FROM search_events').get();
 assert.equal(event?.status,'error');assert.equal(event?.error_code,'PROVIDER_ERROR');
});
