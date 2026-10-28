import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCandidates, recommend } from '../server/recommend.ts';
import { createTravelTimeProvider, RoutingError, type TravelTimeProvider } from '../server/travel-time.ts';
import type { Hub, RecommendRequest } from '../src/shared.ts';

const at = (time: string) => `2026-09-26T${time}:00+09:00`;
const route = (originId: string, start: string, end = '14:55') => ({ originId, departureAt: at(start), arrivalAt: at(end), transfers: 0 });

test('최장 부담 우선, 동률은 합계, 누락·늦은 도착은 제외', () => {
  const candidates = [
    {hubId: 'A', routes: [route('a', '14:00'), route('b', '14:40')]},
    {hubId: 'B', routes: [route('a', '14:10'), route('b', '14:15')]},
    {hubId: 'C', routes: [route('a', '14:10'), route('b', '14:25')]},
    {hubId: 'missing', routes: [route('a', '14:50')]},
    {hubId: 'late', routes: [route('a', '14:50', '15:01'), route('b', '14:50')]},
  ];
  const result = rankCandidates(candidates, ['a', 'b'], at('15:00'), at('12:00'));
  assert.deepEqual(result.map(x => x.hubId), ['C', 'B', 'A']);
  assert.equal(result[0].maxBurdenSeconds, 3000);
  assert.equal(result[0].sumBurdenSeconds, 5100);
  assert.equal(result[0].participantRoutes[0].earlyWaitSeconds, 300);
  assert.equal(result[0].participantRoutes[0].travelSeconds, 2700);
});

test('stable ID resolves exact ties and four-result cap follows complete ranking', () => {
  const candidates = ['z','d','c','b','a'].map(hubId => ({hubId, routes:[route('b','14:30'),route('a','14:30')]}));
  assert.deepEqual(rankCandidates(candidates, ['a','b'], at('15:00'), at('12:00')).map(x=>x.hubId), ['a','b','c','d']);
  assert.equal(rankCandidates(candidates, ['a','b'], at('15:00'), at('12:00'), {limit: null}).length, 5);
  assert.deepEqual(candidates.map(x=>x.hubId), ['z','d','c','b','a']);
});

test('past departure, reversed timestamps, duplicates and invalid transfers cannot become recommendations', () => {
  const candidates = [
    {hubId:'past', routes:[route('a','11:59')]},
    {hubId:'reverse', routes:[route('a','14:59','14:55')]},
    {hubId:'duplicate', routes:[route('a','14:30'),route('a','14:30')]},
    {hubId:'bad', routes:[{...route('a','14:30'),transfers:-1}]},
  ];
  assert.deepEqual(rankCandidates(candidates,['a'],at('15:00'),at('12:00')), []);
});

test('midnight route uses timestamps and preserves all colocated participants', () => {
  const routes = ['a','b','c'].map(originId=>({originId,departureAt:'2026-09-26T23:30:00+09:00',arrivalAt:'2026-09-27T00:05:00+09:00',transfers:1}));
  const result = rankCandidates([{hubId:'night',routes}], ['a','b','c'], '2026-09-27T00:15:00+09:00','2026-09-26T20:00:00+09:00');
  assert.equal(result[0].sumBurdenSeconds, 8100);
  assert.equal(result[0].participantRoutes[0].travelSeconds, 2100);
});

const now=Date.parse('2026-10-06T00:00:00Z');
const req:RecommendRequest={meetingAt:'2026-10-06T06:00:00Z',origins:[{id:'a',label:'A',lat:37,lng:127},{id:'b',label:'B',lat:37.1,lng:127.1}]};
const hubs:Hub[]=Array.from({length:12},(_,i)=>({id:`h${i}`,name:`H${i}`,lat:37.5,lng:127.5,kind:'rail',regionCode:'11',sourceId:String(i),sourceDate:'2026-10-01',sourceUrl:'https://example.org',verified:true}));
const goodRoutes=(request:RecommendRequest,hubId:string)=>({hubId,routes:request.origins.map(o=>({originId:o.id,departureAt:'2026-10-06T05:40:00Z',arrivalAt:'2026-10-06T05:55:00Z',transfers:0}))});
const fake=(overrides:Partial<TravelTimeProvider>):TravelTimeProvider=>({hits:0,now:()=>now,check(){},async reachable(){return {};},async matrix(request,hubs){return hubs.map(h=>goodRoutes(request,h.id));},...overrides});

test('expands 30/60/120 then bisects to 180 seconds and validates every final hub',async()=>{
  const probes:number[]=[];let checked:string[]=[];
  const p=fake({async reachable(_r,_h,seconds){probes.push(seconds);const ids=seconds>=4000?hubs.map(h=>h.id):[];return {a:ids,b:ids};},async matrix(r,hs){checked=hs.map(h=>h.id);return hs.map(h=>goodRoutes(r,h.id));}});
  const result=await recommend(req,hubs,p);
  assert.deepEqual(probes,[1800,3600,7200,5400,4500,4050,3825,3937]);
  assert.equal(checked.length,12);assert.equal(result.length,4);
});

test('no intersection expands through four hours, while near meetings cap at current departure',async()=>{
  for(const [meetingAt,expected] of [[req.meetingAt,[1800,3600,7200,14400]],['2026-10-06T00:40:00Z',[1800,2400]]] as const){
    const probes:number[]=[];
    const result=await recommend({...req,meetingAt},hubs,fake({async reachable(_r,_h,seconds){probes.push(seconds);return {a:[],b:[]};},async matrix(){throw Error('must not validate absent candidates');}}));
    assert.deepEqual(probes,expected);assert.deepEqual(result,[]);
  }
});

test('monotonicity is checked per participant even while both intersections are empty',async()=>{
  const p=fake({async reachable(_r,_h,seconds){return seconds===1800?{a:['h0'],b:[]}:{a:[],b:['h0']};}});
  await assert.rejects(recommend(req,hubs,p),e=>e instanceof RoutingError&&e.code==='non_monotonic_reachability');
});

test('candidate budget fails before matrix rather than returning a biased subset',async()=>{
  let calls=0;
  const p=fake({async reachable(){return {a:hubs.map(h=>h.id),b:hubs.map(h=>h.id)};},async matrix(){calls++;return [];}});
  await assert.rejects(recommend(req,hubs,p,{maxCandidates:10}),e=>e instanceof RoutingError&&e.code==='routing_candidate_budget_exceeded');
  assert.equal(calls,0);
});

const overshootReachable:TravelTimeProvider['reachable']=async(_r,_h,seconds)=>{
  const ids=seconds>=3600?hubs.slice(0,6).map(h=>h.id):seconds>=2700?hubs.slice(0,5).map(h=>h.id):seconds>=2100?['h0']:[];
  return {a:ids,b:ids};
};
const burdenRoute=(request:RecommendRequest,hubId:string,seconds:number)=>({hubId,routes:request.origins.map(o=>({
  originId:o.id,departureAt:new Date(Date.parse(request.meetingAt)-seconds*1000).toISOString(),arrivalAt:request.meetingAt,transfers:0,
}))});

test('arrival beyond the final map reuses the smallest covering snapshot and validates only new hubs',async()=>{
  const probes:number[]=[], batches:string[][]=[];
  const burdens=[2485,2113,2413,2633,2879,2234];
  const p=fake({async reachable(r,hs,seconds){probes.push(seconds);return overshootReachable(r,hs,seconds);},async matrix(r,hs){
    batches.push(hs.map(h=>h.id));return hs.map(h=>burdenRoute(r,h.id,burdens[Number(h.sourceId)]));
  }});
  const result=await recommend(req,hubs,p,{maxCandidates:5});
  assert.deepEqual(probes,[1800,3600,2700,2250,2025,2137]);
  assert.deepEqual(batches,[['h0'],['h1','h2','h3','h4']]);
  assert.deepEqual(result.map(r=>r.hubId),['h1','h2','h0','h3']);
  assert.equal(result[0].maxBurdenSeconds,2113);
});

test('arrival fallback keeps the combined candidate budget and propagates provider failure',async()=>{
  for(const maxCandidates of [4,5]){
    let calls=0;
    const p=fake({reachable:overshootReachable,async matrix(r,hs){
      calls++;
      if(calls>1) throw new RoutingError('routing_timeout',504);
      return hs.map(h=>burdenRoute(r,h.id,2485));
    }});
    await assert.rejects(recommend(req,hubs,p,{maxCandidates}),e=>e instanceof RoutingError&&e.code===(maxCandidates===4?'routing_candidate_budget_exceeded':'routing_timeout'));
    assert.equal(calls,maxCandidates===4?1:2);
  }
});

test('arrival fallback skips absent or unchanged covering snapshots',async()=>{
  for(const seconds of [2000,2485,4000]){
    let calls=0;
    const p=fake({async reachable(_r,_h,limit){const ids=limit>=2100?['h0']:[];return {a:ids,b:ids};},async matrix(r,hs){
      calls++;return hs.map(h=>burdenRoute(r,h.id,seconds));
    }});
    assert.equal((await recommend(req,hubs,p)).length,1);
    assert.equal(calls,1);
  }
});

test('arrival fallback rechecks cached departures and rejects incomplete added routes',async()=>{
  let current=now,calls=0;
  const p=fake({now:()=>current,reachable:overshootReachable,async matrix(r,hs){
    calls++;
    if(calls===1) return hs.map(h=>burdenRoute(r,h.id,2485));
    current=Date.parse(r.meetingAt)-2400*1000;
    return [burdenRoute(r,'h1',2113),{hubId:'h2',routes:[]},burdenRoute(r,'h3',2633),
      {hubId:'h4',routes:burdenRoute(r,'h4',2000).routes.map(p=>({...p,arrivalAt:new Date(Date.parse(r.meetingAt)+1000).toISOString()}))}];
  }});
  assert.deepEqual((await recommend(req,hubs,p)).map(r=>r.hubId),['h1']);
  assert.equal(calls,2);
});

test('all invalid arrival routes trigger only one 180-second enlargement',async()=>{
  const probes:number[]=[];let calls=0;
  const p=fake({async reachable(_r,_h,seconds){probes.push(seconds);return {a:['h0'],b:['h0']};},async matrix(){calls++;return [];}});
  assert.deepEqual(await recommend(req,hubs,p),[]);
  assert.equal(calls,2);assert.deepEqual(probes,[1800,900,450,225,112,292]);
});

test('response-time clock excludes routes that became past while provider was running',async()=>{
  let current=now;
  const p=fake({now:()=>current,async reachable(){return {a:['h0'],b:['h0']};},async matrix(r,hs){current=Date.parse('2026-10-06T05:41:00Z');return hs.map(h=>goodRoutes(r,h.id));}});
  assert.deepEqual(await recommend(req,hubs,p),[]);
});

test('identical origin and hub returns zero burden for every participant without provider work',async()=>{
  const sameReq={...req,origins:req.origins.map(o=>({...o,lat:37.5,lng:127.5}))};
  const p=fake({async reachable(){throw Error('must not call');},async matrix(){throw Error('must not call');}});
  const result=await recommend(sameReq,hubs,p);
  assert.equal(result.length,4);assert.equal(result[0].sumBurdenSeconds,0);assert.equal(result[0].participantRoutes.length,2);
});

test('near-meeting expansion recalculates the departure cap after an elapsed provider call',async()=>{
  let current=now;
  const probes:number[]=[];
  const p=createTravelTimeProvider({appId:'test',apiKey:'test',now:()=>current,fetchImpl:async(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    probes.push(body.departure_searches[0].travel_time);
    for(const search of body.departure_searches) assert.ok(Date.parse(search.departure_time)>=current);
    current+=1000;
    return new Response(JSON.stringify({results:body.departure_searches.map((search:{id:string})=>({search_id:search.id,shapes:[]}))}));
  }});
  assert.deepEqual(await recommend({...req,meetingAt:'2026-10-06T00:40:00Z'},hubs,p),[]);
  assert.deepEqual(probes,[1800,2399]);
  assert.equal(p.hits,4);
});

test('clock crossing the provider preflight boundary lowers the probe without spending a hit',async()=>{
  let current=now;
  const probes:number[]=[];
  const p=createTravelTimeProvider({appId:'test',apiKey:'test',now:()=>current,fetchImpl:async(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    return new Response(JSON.stringify({results:body.departure_searches.map((search:{id:string})=>({search_id:search.id,shapes:[]}))}));
  }});
  const reachable=p.reachable;
  p.reachable=async(r,hs,seconds)=>{
    probes.push(seconds);
    if(probes.length===1) current++;
    return reachable(r,hs,seconds);
  };
  assert.deepEqual(await recommend({...req,meetingAt:'2026-10-06T00:10:00Z'},hubs,p),[]);
  assert.deepEqual(probes,[600,599]);
  assert.equal(p.hits,2);
});

test('a clock-adjusted upper bound still checks participant monotonicity',async()=>{
  let current=now;
  const p=fake({now:()=>current,async reachable(_r,_h,seconds){
    if(seconds===1800){current+=1000;return {a:['h0'],b:[]};}
    assert.equal(seconds,2399);return {a:[],b:['h0']};
  }});
  await assert.rejects(recommend({...req,meetingAt:'2026-10-06T00:40:00Z'},hubs,p),e=>e instanceof RoutingError&&e.code==='non_monotonic_reachability');
});
