import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { Hub, Origin, RecommendRequest } from '../src/shared.ts';
import type { CandidateRoutes, ParticipantRouteInput } from './recommend.ts';
export class RoutingError extends Error {code:string;status:number;constructor(code:string,status:number){super('Routing request failed.');this.code=code;this.status=status;}}
export type TravelTimeProviderOptions={appId:string;apiKey:string;fetchImpl?:typeof fetch;now?:()=>number;signal?:AbortSignal;maxHits?:number;beforeRequest?:(hits:number)=>Promise<void>};
export type TravelTimeProvider={readonly hits:number;now:()=>number;check:()=>void;reachable:(request:RecommendRequest,hubs:Hub[],seconds:number)=>Promise<Record<string,string[]>>;matrix:(request:RecommendRequest,hubs:Hub[])=>Promise<CandidateRoutes[]>};
const TRANSPORTATION = {type:'public_transport',walking_time:900} as const;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const invalid = (): never => {throw new RoutingError('provider_invalid_response',502);};
const object = (value:unknown):Record<string,unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : invalid();
const array = (value:unknown):unknown[] => Array.isArray(value) ? value : invalid();
const same = (a:{lat:number;lng:number},b:{lat:number;lng:number}) => a.lat===b.lat && a.lng===b.lng;
const zeroRoute = (origin:Origin, meetingAt:string):ParticipantRouteInput => ({originId:origin.id,departureAt:meetingAt,arrivalAt:meetingAt,transfers:0});

function results(payload:unknown, ids:string[]):Map<string,Record<string,unknown>> {
  const mapped = new Map<string,Record<string,unknown>>();
  for (const value of array(object(payload).results)) {
    const result=object(value);
    if (typeof result.search_id!=='string' || !ids.includes(result.search_id) || mapped.has(result.search_id)) invalid();
    mapped.set(result.search_id as string,result);
  }
  if (mapped.size !== ids.length) invalid();
  return mapped;
}

function ring(value:unknown):number[][] {
  const points=array(value).map(value=>{
    const point=object(value);
    if (typeof point.lat!=='number'||typeof point.lng!=='number'||!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||Math.abs(point.lat)>90||Math.abs(point.lng)>180) return invalid();
    return [point.lng,point.lat];
  });
  if(new Set(points.map(p=>p.join(','))).size<3) invalid();
  const first=points[0],last=points.at(-1)!;
  if(first[0]!==last[0]||first[1]!==last[1]) points.push([...first]);
  return points;
}

function shapes(value:unknown) {
  return array(value).map(value=>{
    const shape=object(value);
    return {type:'Polygon' as const,coordinates:[ring(shape.shell),...array(shape.holes).map(ring)]};
  });
}

// SDK route modes are not the request transportation names. Fail closed for
// national/ambiguous rail, coaches, ferries, vehicles and unrecognized modes.
// Urban bus/overground coverage still requires the deployment approval gate.
const ALLOWED_MODES=new Set(['walk','bus','rail_underground','rail_overground']);
function parseRoute(properties:unknown,origin:Origin):ParticipantRouteInput|undefined {
  const variants=array(properties);
  if(variants.length!==1) return undefined; // range is deliberately disabled
  const property=object(variants[0]);
  if(!Number.isInteger(property.travel_time)||Number(property.travel_time)<0 || !property.route) return undefined;
  const route=object(property.route);
  if(typeof route.departure_time!=='string'||typeof route.arrival_time!=='string'||!Array.isArray(route.parts)||route.parts.length===0) return undefined;
  let boardings=0;
  for(const value of route.parts){
    const part=object(value);
    if(typeof part.mode!=='string'||!ALLOWED_MODES.has(part.mode)) return undefined;
    if(part.mode!=='walk'){
      if(part.type!=='public_transport') return undefined;
      boardings++;
    }
  }
  return {originId:origin.id,departureAt:route.departure_time,arrivalAt:route.arrival_time,transfers:Math.max(0,boardings-1)};
}

export function createTravelTimeProvider(options:TravelTimeProviderOptions):TravelTimeProvider {
  return createProvider(options,30_000);
}

// Only the offline validation adapter may use this explicitly named escape hatch.
export function createValidationTravelTimeProvider(options:TravelTimeProviderOptions,validationDeadlineMs:number):TravelTimeProvider {
  if(!Number.isFinite(validationDeadlineMs)||validationDeadlineMs<1||validationDeadlineMs>86_400_000) throw new RoutingError('invalid_validation_deadline',400);
  return createProvider(options,validationDeadlineMs);
}

function createProvider(options:TravelTimeProviderOptions,budgetMs:number):TravelTimeProvider {
  const now=options.now??Date.now, fetchImpl=options.fetchImpl??fetch;
  const deadline=now()+budgetMs, wallDeadline=Date.now()+budgetMs;
  const maxHits=options.maxHits??120;
  if(!Number.isInteger(maxHits)||maxHits<1) throw new RoutingError('invalid_routing_budget',503);
  let hits=0;
  const check=()=>{
    if(options.signal?.aborted) throw new RoutingError('cancelled',499);
    if(now()>=deadline || Date.now()>=wallDeadline) throw new RoutingError('routing_timeout',504);
  };

  async function post(endpoint:string,body:unknown,cost:number):Promise<unknown>{
    for(let attempt=0;attempt<2;attempt++){
      check();
      if(hits+cost>maxHits) throw new RoutingError('routing_budget_exceeded',503);
      if(!options.appId||!options.apiKey) throw new RoutingError('provider_not_configured',503);
      const controller=new AbortController();
      let timer:ReturnType<typeof setTimeout>|undefined;
      let retryTimer:ReturnType<typeof setTimeout>|undefined;
      let retryAfterMs:number|undefined;
      let abort:()=>void=()=>{};
      const stopped=new Promise<never>((_resolve,reject)=>{
        abort=()=>{controller.abort();reject(new RoutingError('cancelled',499));};
        options.signal?.addEventListener('abort',abort,{once:true});
        timer=setTimeout(()=>{controller.abort();reject(new RoutingError('routing_timeout',504));},Math.max(1,Math.min(deadline-now(),wallDeadline-Date.now())));
      });
      try{
        const operation=async()=>{
          try{await options.beforeRequest?.(cost);}catch(error){throw error instanceof RoutingError ? error : new RoutingError('quota_unavailable',503);}
          check();
          if(controller.signal.aborted) throw new RoutingError('routing_timeout',504);
          hits+=cost;
          let response:Response;
          try{response=await fetchImpl(`https://api.traveltimeapp.com/v4/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','X-Application-Id':options.appId,'X-Api-Key':options.apiKey},body:JSON.stringify(body),signal:controller.signal});}
          catch{check();throw new RoutingError('provider_unavailable',503);}
          check();
          if(!response.ok){
            void response.body?.cancel().catch(()=>{});
            const header=response.headers.get('Retry-After');
            if(header!==null){
              const value=header.trim();
              const delay=/^\d+$/.test(value)?Number(value)*1000:/GMT$/.test(value)?Date.parse(value)-now():NaN;
              // A present but invalid/overflowing header cannot justify an early retry.
              retryAfterMs=Number.isFinite(delay)?Math.max(0,delay):Infinity;
            }
            if(response.status===429) throw new RoutingError('provider_rate_limited',429);
            throw new RoutingError(response.status>=500||response.status===408?'provider_unavailable':'provider_rejected',response.status>=500||response.status===408?503:502);
          }
          const length=Number(response.headers.get('content-length'));
          if(length>MAX_BODY_BYTES){void response.body?.cancel().catch(()=>{});throw new RoutingError('routing_response_too_large',503);}
          const reader=response.body?.getReader();
          if(!reader) return invalid();
          const decoder=new TextDecoder();let text='',size=0;
          try{
            for(;;){
              const next=await reader.read();check();if(next.done) break;
              size+=next.value.byteLength;
              if(size>MAX_BODY_BYTES){await reader.cancel();throw new RoutingError('routing_response_too_large',503);}
              text+=decoder.decode(next.value,{stream:true});
            }
            text+=decoder.decode();
          }finally{reader.releaseLock();}
          try{return JSON.parse(text) as unknown;}catch{return invalid();}
        };
        return await Promise.race([operation(),stopped]);
      }catch(error){
        const safe=error instanceof RoutingError?error:new RoutingError('provider_invalid_response',502);
        if(attempt===0&&(safe.code==='provider_unavailable'||(safe.code==='provider_rate_limited'&&retryAfterMs!==undefined))){
          check();
          const delay=retryAfterMs??0;
          if(delay>=Math.min(deadline-now(),wallDeadline-Date.now())) throw safe;
          if(delay>0) await Promise.race([new Promise<void>(resolve=>{retryTimer=setTimeout(resolve,delay);}),stopped]);
          check();continue;
        }
        throw safe;
      }finally{
        clearTimeout(timer);clearTimeout(retryTimer);options.signal?.removeEventListener('abort',abort);
      }
    }
    throw new RoutingError('provider_unavailable',503);
  }

  return {
    get hits(){return hits;},now,check,
    async reachable(request,hubs,seconds){
      check();
      if(!Number.isInteger(seconds)||seconds<1||seconds>14400) throw new RoutingError('invalid_travel_limit',400);
      const departure=Date.parse(request.meetingAt)-seconds*1000;
      if(!Number.isFinite(departure)||departure<now()) throw new RoutingError('departure_in_past',400);
      const unique:Origin[]=[];
      const indices=request.origins.map(origin=>{
        let index=unique.findIndex(other=>same(origin,other));
        if(index<0){index=unique.length;unique.push(origin);}return index;
      });
      const searches=unique.map((origin,i)=>({id:`o${i}`,coords:{lat:origin.lat,lng:origin.lng},transportation:TRANSPORTATION,departure_time:new Date(departure).toISOString(),travel_time:seconds}));
      const sets=new Map<number,string[]>();
      for(let offset=0;offset<searches.length;offset+=10){
        const batch=searches.slice(offset,offset+10);
        const mapped=results(await post('time-map',{departure_searches:batch},batch.length),batch.map(s=>s.id));
        for(let i=0;i<batch.length;i++){
          const index=offset+i, polygons=shapes(mapped.get(batch[i].id)!.shapes);
          sets.set(index,hubs.filter(h=>same(h,unique[index])||polygons.some(p=>booleanPointInPolygon([h.lng,h.lat],p,{ignoreBoundary:false}))).map(h=>h.id));
        }
      }
      check();
      return Object.fromEntries(request.origins.map((origin,i)=>[origin.id,sets.get(indices[i])??[]]));
    },
    async matrix(request,hubs){
      check();
      const travelTime=Math.min(14400,Math.floor((Date.parse(request.meetingAt)-now())/1000));
      if(travelTime<1) return [];
      const candidates:CandidateRoutes[]=hubs.map(h=>({hubId:h.id,routes:request.origins.filter(o=>same(o,h)).map(o=>zeroRoute(o,request.meetingAt))}));
      const needed=hubs.map((h,i)=>({h,i})).filter(({h})=>request.origins.some(o=>!same(o,h)));
      for(let offset=0;offset<needed.length;offset+=10){
        const batch=needed.slice(offset,offset+10);
        const searches=batch.map(({h,i})=>({id:`h${i}`,arrival_location_id:`h${i}`,departure_location_ids:request.origins.flatMap((o,j)=>same(o,h)?[]:[`o${j}`]),arrival_time:request.meetingAt,travel_time:travelTime,transportation:TRANSPORTATION,properties:['travel_time','route']}));
        const locations=[...request.origins.map((o,j)=>({id:`o${j}`,coords:{lat:o.lat,lng:o.lng}})),...batch.map(({h,i})=>({id:`h${i}`,coords:{lat:h.lat,lng:h.lng}}))];
        const mapped=results(await post('time-filter',{locations,arrival_searches:searches},searches.length),searches.map(s=>s.id));
        for(const {i} of batch){
          const result=mapped.get(`h${i}`)!, search=searches.find(s=>s.id===`h${i}`)!;
          const seen=new Set<string>();
          for(const value of array(result.unreachable)){
            if(typeof value!=='string'||!search.departure_location_ids.includes(value)||seen.has(value)) invalid();seen.add(value as string);
          }
          for(const value of array(result.locations)){
            const location=object(value),id=location.id;
            if(typeof id!=='string'||!search.departure_location_ids.includes(id)||seen.has(id)) invalid();seen.add(id as string);
            const origin=request.origins[Number((id as string).slice(1))];
            const route=parseRoute(location.properties,origin);
            if(route) candidates[i].routes.push(route);
          }
          candidates[i].routes.sort((a,b)=>request.origins.findIndex(o=>o.id===a.originId)-request.origins.findIndex(o=>o.id===b.originId));
        }
      }
      check();return candidates;
    }
  };
}
