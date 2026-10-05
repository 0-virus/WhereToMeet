import type { ValidationAdapterFactory } from '../scripts/validation/types.ts';
import {createValidationTravelTimeProvider} from './travel-time.ts';
import {recommend,rankCandidates} from './recommend.ts';

// Imported only by the CLI. Its quota pacing can exceed the fixed production
// deadline; each measured operation gets a fresh explicitly extended provider.
export const createRoutingValidationAdapter:ValidationAdapterFactory=options=>{
  const provider=(count:number)=>createValidationTravelTimeProvider({...options,maxHits:Math.max(120,2*(count+100))},options.validationDeadlineMs);
  return {
    async recommend(request,hubs){return recommend(request,hubs,provider(hubs.length),{maxCandidates:Math.max(1,hubs.length)});},
    async matrix(request,hubs){
      const p=provider(hubs.length),candidates=await p.matrix(request,hubs);
      p.check();
      return rankCandidates(candidates,request.origins.map(o=>o.id),request.meetingAt,new Date(options.now()).toISOString(),{limit:null});
    },
    async reachable(request,hubs,seconds){return provider(hubs.length).reachable(request,hubs,seconds);}
  };
};
