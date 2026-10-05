import test from 'node:test';
import assert from 'node:assert/strict';
import type { Hub, RecommendRequest } from '../src/shared.ts';
import {createRoutingValidationAdapter} from '../server/validation-adapter.ts';

test('validation adapter matrix preserves all valid hubs while recommend returns four',async()=>{
  const now=Date.parse('2026-10-06T00:00:00Z');
  const request:RecommendRequest={meetingAt:'2026-10-06T06:00:00Z',origins:[{id:'a',label:'A',lat:37,lng:127},{id:'b',label:'B',lat:37.1,lng:127.1}]};
  const hubs:Hub[]=Array.from({length:6},(_,i)=>({id:`h${i}`,name:'H',lat:37.5,lng:127.5,kind:'rail',regionCode:'11',sourceId:'x',sourceDate:'2026-10-01',sourceUrl:'https://example.org',verified:false}));
  const adapter=createRoutingValidationAdapter({appId:'test',apiKey:'test',now:()=>now,validationDeadlineMs:3600000,fetchImpl:async(url,init)=>{
    const body=JSON.parse(String(init?.body));
    const results=String(url).endsWith('time-map')?body.departure_searches.map((s:any)=>({search_id:s.id,shapes:[{shell:[{lat:37,lng:127},{lat:38,lng:127},{lat:38,lng:128},{lat:37,lng:128}],holes:[]}]})):body.arrival_searches.map((s:any)=>({search_id:s.id,unreachable:[],locations:s.departure_location_ids.map((id:string)=>({id,properties:[{travel_time:600,route:{departure_time:'2026-10-06T05:50:00Z',arrival_time:'2026-10-06T06:00:00Z',parts:[{type:'public_transport',mode:'bus'}]}}]}))}));
    return new Response(JSON.stringify({results}));
  }});
  assert.equal((await adapter.matrix(request,hubs)).length,6);
  assert.equal((await adapter.recommend(request,hubs)).length,4);
  assert.deepEqual(await adapter.reachable(request,hubs,1800),{a:hubs.map(h=>h.id),b:hubs.map(h=>h.id)});
});
