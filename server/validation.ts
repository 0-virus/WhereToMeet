import type { RecommendRequest, Origin } from '../src/shared.ts';
import { ApiFailure } from './errors.ts';
const invalid=()=>new ApiFailure('INVALID_INPUT',400);
export function validId(value:unknown):value is string {return typeof value==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);}
export function validateRecommendation(value:unknown,now:number):RecommendRequest {
 if(!value || typeof value!=='object')throw invalid();const v=value as Record<string,unknown>;
 if(!Array.isArray(v.origins)||v.origins.length<2||v.origins.length>4)throw invalid();
 const origins:Origin[]=v.origins.map(o=>{
  if(!o||typeof o!=='object'||!validId(o.id)||typeof o.label!=='string'||!o.label.trim()||o.label.length>100||typeof o.lat!=='number'||typeof o.lng!=='number'||!Number.isFinite(o.lat)||!Number.isFinite(o.lng)||o.lat<33||o.lat>39||o.lng<124||o.lng>132)throw invalid();
  if(o.address!==undefined&&(typeof o.address!=='string'||o.address.length>300))throw invalid();
  return {id:o.id,label:o.label.trim(),lat:o.lat,lng:o.lng,...(o.address?{address:o.address}:{})};
 });
 if(new Set(origins.map(o=>o.id)).size!==origins.length)throw invalid();
 if(typeof v.meetingAt!=='string')throw invalid();
 const match=v.meetingAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/);
 if(!match)throw invalid();
 const [,y,m,d,h,min,s]=match;const local=new Date(Date.UTC(+y,+m-1,+d));
 if(local.getUTCFullYear()!==+y||local.getUTCMonth()!==+m-1||local.getUTCDate()!==+d||+h>23||+min>59||+s>59)throw invalid();
 const meeting=Date.parse(v.meetingAt);if(!Number.isFinite(meeting)||meeting<=now||meeting>now+7*86400000)throw invalid();
 if(v.historyId!==undefined&&!validId(v.historyId))throw invalid();
 return {origins,meetingAt:new Date(meeting).toISOString(),...(v.historyId?{historyId:v.historyId as string}:{})};
}
export async function readJson(request:Request):Promise<unknown> {
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw invalid();
 const reader=request.body?.getReader();if(!reader)throw invalid();let size=0;const parts:Uint8Array[]=[];
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw invalid();}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw invalid();}
}
