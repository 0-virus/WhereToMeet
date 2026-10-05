import { MAX_RECOMMENDATIONS, type Recommendation, type RecommendRequest, type Hub } from '../src/shared.ts';
import { RoutingError, type TravelTimeProvider } from './travel-time.ts';
export type ParticipantRouteInput = {originId:string; departureAt:string; arrivalAt:string; transfers:number};
export type CandidateRoutes = {hubId:string; routes:ParticipantRouteInput[]};
export async function recommend(request:RecommendRequest,hubs:Hub[],provider:TravelTimeProvider,options:{maxCandidates?:number}={}):Promise<Recommendation[]> {
  provider.check();
  const maxCandidates=options.maxCandidates??100;
  if(!Number.isInteger(maxCandidates)||maxCandidates<1) throw new RoutingError('invalid_candidate_budget',503);
  const originIds=request.origins.map(o=>o.id);
  const current=provider.now(),meeting=Date.parse(request.meetingAt);
  if(!Number.isFinite(meeting)||meeting<=current||new Set(originIds).size!==originIds.length||!originIds.length||new Set(hubs.map(h=>h.id)).size!==hubs.length) throw new RoutingError('invalid_routing_input',400);
  const finish=(candidates:CandidateRoutes[])=>{
    provider.check();
    return rankCandidates(candidates,originIds,request.meetingAt,new Date(provider.now()).toISOString()).map(r=>({...r,hub:hubs.find(h=>h.id===r.hubId)}));
  };
  const identical=hubs.filter(h=>request.origins.every(o=>o.lat===h.lat&&o.lng===h.lng));
  if(identical.length) return finish(identical.map(h=>({hubId:h.id,routes:request.origins.map(o=>({originId:o.id,departureAt:request.meetingAt,arrivalAt:request.meetingAt,transfers:0}))})));
  if(!hubs.length) return [];
  const cap=Math.min(14400,Math.floor((meeting-current)/1000));
  if(cap<1) return [];
  const samples=new Map<number,Map<string,Set<string>>>();
  const catalogIds=new Set(hubs.map(h=>h.id));
  async function candidatesAt(seconds:number):Promise<Hub[]>{
    provider.check();
    let sample=samples.get(seconds);
    if(!sample){
      const reachable=await provider.reachable(request,hubs,seconds);
      sample=new Map(originIds.map(id=>{
        if(!Array.isArray(reachable[id])||reachable[id].some(h=>!catalogIds.has(h))) throw new RoutingError('provider_invalid_response',502);
        return [id,new Set(reachable[id])];
      }));
      for(const [otherSeconds,otherSample] of samples){
        for(const id of originIds){
          const smaller=seconds<otherSeconds?sample.get(id)!:otherSample.get(id)!;
          const larger=seconds<otherSeconds?otherSample.get(id)!:sample.get(id)!;
          if([...smaller].some(h=>!larger.has(h))) throw new RoutingError('non_monotonic_reachability',502);
        }
      }
      samples.set(seconds,sample);
    }
    return hubs.filter(h=>originIds.every(id=>sample!.get(id)!.has(h.id)));
  }
  let low=0,high=Math.min(1800,cap),finalCandidates=await candidatesAt(high);
  while(!finalCandidates.length&&high<cap){
    low=high;high=Math.min(high*2,cap);finalCandidates=await candidatesAt(high);
  }
  if(!finalCandidates.length) return [];
  while(high-low>180){
    const middle=Math.floor((low+high)/2), candidates=await candidatesAt(middle);
    if(candidates.length){high=middle;finalCandidates=candidates;}else low=middle;
  }
  async function validate(candidates:Hub[]){
    if(candidates.length>maxCandidates) throw new RoutingError('routing_candidate_budget_exceeded',503);
    return finish(await provider.matrix(request,candidates));
  }
  const ranked=await validate(finalCandidates);
  if(ranked.length) return ranked;
  const enlarged=Math.min(high+180,cap,Math.floor((meeting-provider.now())/1000));
  if(enlarged<=high) return [];
  return validate(await candidatesAt(enlarged));
}
export function rankCandidates(candidates:CandidateRoutes[],originIds:string[],meetingAt:string,now:string,options:{limit?:number|null}={}):Recommendation[] {
  const meeting = Date.parse(meetingAt), current = Date.parse(now);
  if (!Number.isFinite(meeting) || !Number.isFinite(current) || meeting < current || !originIds.length || new Set(originIds).size !== originIds.length) return [];
  const ranked: Recommendation[] = [];
  const duplicateHubs = new Set(candidates.filter((c,i)=>candidates.findIndex(x=>x.hubId===c.hubId)!==i).map(c=>c.hubId));
  for (const candidate of candidates) {
    if (duplicateHubs.has(candidate.hubId) || candidate.routes.length !== originIds.length || new Set(candidate.routes.map(r=>r.originId)).size !== originIds.length) continue;
    const participantRoutes = originIds.flatMap(originId => {
      const route = candidate.routes.find(r=>r.originId===originId);
      if (!route) return [];
      const departure = Date.parse(route.departureAt), arrival = Date.parse(route.arrivalAt);
      if (!Number.isFinite(departure) || !Number.isFinite(arrival) || departure < current || arrival < departure || arrival > meeting || !Number.isInteger(route.transfers) || route.transfers < 0) return [];
      const travelSeconds = (arrival-departure)/1000, earlyWaitSeconds = (meeting-arrival)/1000, burdenSeconds = (meeting-departure)/1000;
      if (![travelSeconds,earlyWaitSeconds,burdenSeconds].every(Number.isInteger)) return [];
      return [{...route,travelSeconds,earlyWaitSeconds,burdenSeconds}];
    });
    if (participantRoutes.length !== originIds.length) continue;
    ranked.push({hubId:candidate.hubId,participantRoutes,maxBurdenSeconds:Math.max(...participantRoutes.map(r=>r.burdenSeconds)),sumBurdenSeconds:participantRoutes.reduce((sum,r)=>sum+r.burdenSeconds,0)});
  }
  ranked.sort((a,b)=>a.maxBurdenSeconds-b.maxBurdenSeconds || a.sumBurdenSeconds-b.sumBurdenSeconds || (a.hubId < b.hubId ? -1 : a.hubId > b.hubId ? 1 : 0));
  return options.limit === null ? ranked : ranked.slice(0,options.limit ?? MAX_RECOMMENDATIONS);
}
