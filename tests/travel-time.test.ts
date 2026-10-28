import test from 'node:test';
import assert from 'node:assert/strict';
import { createTravelTimeProvider, createValidationTravelTimeProvider, RoutingError } from '../server/travel-time.ts';
import {rankCandidates} from '../server/recommend.ts';
import type { Hub, RecommendRequest } from '../src/shared.ts';

export const NOW = Date.parse('2026-10-06T00:00:00Z');
export const request:RecommendRequest = {meetingAt:'2026-10-06T06:00:00Z',origins:[{id:'a',label:'A',lat:37,lng:127},{id:'b',label:'B',lat:37.1,lng:127.1}]};
export const hub = (id:string,lat=37.5,lng=127.5):Hub => ({id,name:id,lat,lng,regionCode:'11',kind:'rail',sourceId:id,sourceUrl:'https://example.org',sourceDate:'2026-10-01',verified:true});
export const polygon = {shell:[{lat:37,lng:127},{lat:38,lng:127},{lat:38,lng:128},{lat:37,lng:128}],holes:[[{lat:37.4,lng:127.4},{lat:37.6,lng:127.4},{lat:37.6,lng:127.6},{lat:37.4,lng:127.6}]]};
export const json = (value:unknown) => new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
export const property = (mode='bus') => ({travel_time:900,route:{departure_time:'2026-10-06T05:40:00Z',arrival_time:'2026-10-06T05:55:00Z',parts:[{type:'public_transport',mode,id:0}]}});
export const provider = (fetchImpl:typeof fetch, options:Record<string,unknown>={}) => createTravelTimeProvider({appId:'test-app',apiKey:'test-secret',now:()=>NOW,fetchImpl,...options});

test('forward map retains holes, hole boundaries, outer boundaries and separate polygons',async()=>{
  const p = provider(async(_url, init)=>{
    const body=JSON.parse(String(init?.body));
    assert.equal(body.departure_searches[0].departure_time,'2026-10-06T05:30:00.000Z');
    assert.equal(body.departure_searches[0].travel_time,1800);
    assert.deepEqual(body.departure_searches[0].transportation,{type:'public_transport',walking_time:900});
    assert.equal(body.departure_searches[0].range,undefined);
    return json({results:body.departure_searches.map((s:any)=>({search_id:s.id,shapes:[polygon,{shell:[{lat:39,lng:129},{lat:40,lng:129},{lat:40,lng:130}],holes:[]}]})).reverse()});
  });
  const reachable=await p.reachable(request,[hub('hole'),hub('boundary',37,127.5),hub('hole-edge',37.4,127.5),hub('inside',37.2,127.2),hub('separate',39.2,129.1),hub('outside',41,130)],1800);
  assert.deepEqual(reachable.a,['boundary','hole-edge','inside','separate']);
  assert.deepEqual(reachable.b,reachable.a);
  assert.equal(p.hits,2);
});

test('malformed map response fails safely instead of inventing reachable area',async()=>{
  for(const payload of [{}, {results:[]}, {results:[{search_id:'o0',shapes:[{shell:[{lat:'37',lng:127}],holes:[]}]}]}]){
    await assert.rejects(provider(async()=>json(payload)).reachable(request,[hub('x')],1800),e=>e instanceof RoutingError&&e.code==='provider_invalid_response'&&e.status===502);
  }
});

test('arrival matrix checks all 11 destinations in batches of ten and maps reversed IDs',async()=>{
  const batches:number[]=[];
  const p=provider(async(_url,init)=>{
    const body=JSON.parse(String(init?.body)); batches.push(body.arrival_searches.length);
    assert.equal(body.arrival_searches[0].arrival_time,request.meetingAt);
    assert.deepEqual(body.arrival_searches[0].properties,['travel_time','route']);
    return json({results:body.arrival_searches.map((s:any)=>({search_id:s.id,locations:s.departure_location_ids.map((id:string)=>({id,properties:[property()]})).reverse(),unreachable:[]})).reverse()});
  });
  const candidates=await p.matrix(request,Array.from({length:11},(_,i)=>hub(`h${i}`)));
  assert.deepEqual(batches,[10,1]);
  assert.equal(p.hits,11);
  assert.equal(candidates.length,11);
  assert.deepEqual(candidates[0].routes.map(r=>r.originId),['a','b']);
  assert.equal(candidates[0].routes[0].departureAt,'2026-10-06T05:40:00Z');
});

test('known urban modes survive; prohibited, unknown or missing route modes never survive',async()=>{
  for(const [mode,valid] of [['bus',true],['rail_underground',true],['rail_overground',true],['walk',true],['coach',false],['car',false],['ferry',false],['train',false],['rail_national',false],['underground',false]] as const){
    const p=provider(async(_url,init)=>{const body=JSON.parse(String(init?.body));return json({results:body.arrival_searches.map((s:any)=>({search_id:s.id,locations:s.departure_location_ids.map((id:string)=>({id,properties:[property(mode)]})),unreachable:[]}))});});
    const candidates=await p.matrix(request,[hub('h')]);
    assert.equal(candidates[0].routes.length, valid?2:0,mode);
  }
});

test('same exact location yields zero route and duplicate participants remain separate',async()=>{
  let calls=0;
  const p=provider(async()=>{calls++;throw new Error('must not call');});
  const origins=request.origins.map(o=>({...o,lat:37.5,lng:127.5}));
  const candidates=await p.matrix({...request,origins},[hub('h')]);
  assert.equal(calls,0);
  assert.deepEqual(candidates[0].routes.map(r=>[r.originId,r.departureAt,r.arrivalAt]),[['a',request.meetingAt,request.meetingAt],['b',request.meetingAt,request.meetingAt]]);
});

test('transient failure retries once, reserves every started hit, and sanitizes permanent failure',async()=>{
  let calls=0;const reservations:number[]=[];
  const p=provider(async()=>{calls++;return new Response('private test-secret',{status:503});},{beforeRequest:async(hits:number)=>{reservations.push(hits);}});
  await assert.rejects(p.reachable(request,[hub('h')],1800),e=>e instanceof RoutingError&&e.status===503&&!String(e).includes('test-secret'));
  assert.equal(calls,2); assert.deepEqual(reservations,[2,2]);assert.equal(p.hits,4);
  const auth=provider(async()=>new Response('private',{status:401}));
  await assert.rejects(auth.reachable(request,[],1800),e=>e instanceof RoutingError&&e.status===502);
  assert.equal(auth.hits,2);
});

test('finite hit budget blocks retry and cancelled/expired work starts no request',async()=>{
  const p=provider(async()=>new Response('',{status:503}),{maxHits:2});
  await assert.rejects(p.reachable(request,[],1800),e=>e instanceof RoutingError&&e.code==='routing_budget_exceeded');
  assert.equal(p.hits,2);
  const controller=new AbortController();controller.abort();
  const cancelled=provider(async()=>{throw Error('called');},{signal:controller.signal});
  await assert.rejects(cancelled.reachable(request,[],1800),e=>e instanceof RoutingError&&e.code==='cancelled');
  assert.equal(cancelled.hits,0);
  let time=NOW;const expired=provider(async()=>{throw Error('called');},{now:()=>time});time+=30000;
  await assert.rejects(expired.reachable(request,[],1800),e=>e instanceof RoutingError&&e.status===504);
});

test('quota reservation errors are preserved only when controlled and never count unstarted hits',async()=>{
  const p=provider(async()=>{throw Error('called');},{beforeRequest:async()=>{throw new RoutingError('quota_exceeded',429);}});
  await assert.rejects(p.reachable(request,[],1800),e=>e instanceof RoutingError&&e.code==='quota_exceeded'&&e.status===429); assert.equal(p.hits,0);
});

test('duplicate-coordinate map is called once but every participant keeps a reachable set',async()=>{
  const p=provider(async(_url,init)=>{
    const body=JSON.parse(String(init?.body));assert.equal(body.departure_searches.length,1);
    return json({results:[{search_id:body.departure_searches[0].id,shapes:[polygon]}]});
  });
  const origins=request.origins.map(o=>({...o,lat:37,lng:127}));
  assert.deepEqual(await p.reachable({...request,origins},[hub('h',37.2,127.2)],1800),{a:['h'],b:['h']});assert.equal(p.hits,1);
});

test('missing routes, late arrival and missing participant fail complete candidate validation',async()=>{
  for(const kind of ['missing-route','late','unreachable','missing-time','empty-parts']){
    const p=provider(async(_url,init)=>{
      const body=JSON.parse(String(init?.body));const search=body.arrival_searches[0];
      const locations=search.departure_location_ids.map((id:string,i:number)=>{
        const prop:any=property();
        if(i===0){
          if(kind==='missing-route') delete prop.route;
          if(kind==='missing-time') delete prop.route.departure_time;
          if(kind==='empty-parts') prop.route.parts=[];
          if(kind==='late') prop.route.arrival_time='2026-10-06T06:01:00Z';
        }
        return {id,properties:[prop]};
      });
      if(kind==='unreachable') locations.shift();
      return json({results:[{search_id:search.id,locations,unreachable:kind==='unreachable'?[search.departure_location_ids[0]]:[]}]});
    });
    const candidates=await p.matrix(request,[hub('h')]);
    assert.deepEqual(rankCandidates(candidates,['a','b'],request.meetingAt,new Date(NOW).toISOString()),[],kind);
  }
});

test('matrix duplicate IDs, missing searches and impossible response containers fail closed',async()=>{
  for(const payload of [{results:[]},{results:[{search_id:'h0',locations:[{id:'o0',properties:[property()]},{id:'o0',properties:[property()]}],unreachable:[]}]},{results:[{search_id:'h0',locations:null,unreachable:[]}]}]){
    await assert.rejects(provider(async()=>json(payload)).matrix(request,[hub('h')]),e=>e instanceof RoutingError&&e.code==='provider_invalid_response');
  }
});

test('cancel interrupts pending fetch without a retry',async()=>{
  const controller=new AbortController();let seenSignal:AbortSignal|undefined;
  const p=provider(async(_url,init)=>{seenSignal=init?.signal as AbortSignal;queueMicrotask(()=>controller.abort());return new Promise(()=>{});},{signal:controller.signal});
  await assert.rejects(p.reachable(request,[],1800),e=>e instanceof RoutingError&&e.code==='cancelled');
  assert.equal(p.hits,2);assert.equal(seenSignal?.aborted,true);
});

test('deadline includes pending quota reservation and stops a late reservation from issuing fetch',async()=>{
  let release:()=>void=()=>{};let calls=0;
  const reservation=new Promise<void>(resolve=>{release=resolve;});
  const p=createValidationTravelTimeProvider({appId:'a',apiKey:'b',now:()=>NOW,beforeRequest:async()=>reservation,fetchImpl:async()=>{calls++;return json({});}},15);
  await assert.rejects(p.reachable(request,[],1800),e=>e instanceof RoutingError&&e.status===504);
  release();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(calls,0);assert.equal(p.hits,0);
});

test('unknown quota errors and oversized responses disclose no sensitive content',async()=>{
  const p=provider(async()=>json({}),{beforeRequest:async()=>{throw Error('test-secret private address');}});
  await assert.rejects(p.reachable(request,[],1800),e=>e instanceof RoutingError&&e.code==='quota_unavailable'&&!String(e).includes('test-secret'));
  const large=provider(async()=>new Response('{}',{headers:{'content-length':'9000000'}}));
  await assert.rejects(large.reachable(request,[],1800),e=>e instanceof RoutingError&&e.code==='routing_response_too_large');
});

test('503 Retry-After seconds delay is honored before the only retry',async()=>{
  const started:number[]=[];
  const p=provider(async()=>{started.push(Date.now());return new Response('',{status:503,headers:{'Retry-After':'1'}});});
  await assert.rejects(p.reachable(request,[],1800),e=>e instanceof RoutingError&&e.status===503);
  assert.equal(started.length,2);assert.ok(started[1]-started[0]>=950);
});

test('429 retries once only for a valid Retry-After fitting the remaining budget',async()=>{
  for(const [header,wantCalls] of [['0',2],['invalid',1],['1.5',1],['60',1],[undefined,1]] as const){
    let calls=0;
    const p=provider(async()=>{calls++;return new Response('',{status:429,headers:header?{'Retry-After':header}:{}});});
    await assert.rejects(p.reachable(request,[],1800),e=>e instanceof RoutingError&&e.code==='provider_rate_limited'&&e.status===429);
    assert.equal(calls,wantCalls);
  }
});

test('HTTP-date Retry-After beyond deadline is not retried early',async()=>{
  const p=provider(async()=>new Response('',{status:503,headers:{'Retry-After':'Tue, 06 Oct 2026 00:01:00 GMT'}}));
  await assert.rejects(p.reachable(request,[],1800),e=>e instanceof RoutingError&&e.status===503);
  assert.equal(p.hits,2);
});

for(const seconds of [1,450,899,900,901,1800]){
  test(`walking allowance fits ${seconds}s map and arrival searches`,async()=>{
    const requests:any[]=[];
    const p=provider(async(_url,init)=>{
      const body=JSON.parse(String(init?.body));requests.push(body);
      return json({results:(body.departure_searches??body.arrival_searches).map((s:any)=>body.departure_searches
        ? {search_id:s.id,shapes:[]}
        : {search_id:s.id,locations:[],unreachable:s.departure_location_ids})});
    });
    await p.reachable(request,[],seconds);
    await p.matrix({...request,meetingAt:new Date(NOW+seconds*1000).toISOString()},[hub('h')]);
    assert.equal(requests.length,2);
    for(const body of requests){
      for(const search of body.departure_searches??body.arrival_searches){
        assert.equal(search.travel_time,seconds);
        assert.deepEqual(search.transportation,{type:'public_transport',walking_time:Math.min(900,seconds)});
      }
    }
  });
}

test('matrix rejects participants omitted from both reachable and unreachable results',async()=>{
  for(const result of [
    {locations:[{id:'o0',properties:[property()]}],unreachable:[]},
    {locations:[],unreachable:['o0']},
    {locations:[],unreachable:[]},
  ]){
    await assert.rejects(provider(async()=>json({results:[{search_id:'h0',...result}]})).matrix(request,[hub('h')]),
      error=>error instanceof RoutingError&&error.code==='provider_invalid_response'&&error.status===502);
  }
});

test('matrix accounts for only requested origins when a participant is already at the hub',async()=>{
  const p=provider(async()=>json({results:[
    {search_id:'h0',locations:[{id:'o1',properties:[property()]}],unreachable:[]},
    {search_id:'h1',locations:[],unreachable:['o1','o0']},
  ]}));
  const candidates=await p.matrix(request,[hub('same',37,127),hub('unreachable')]);
  assert.deepEqual(candidates[0].routes.map(r=>[r.originId,r.departureAt]),[['a',request.meetingAt],['b','2026-10-06T05:40:00Z']]);
  assert.deepEqual(candidates[1].routes,[]);
});
