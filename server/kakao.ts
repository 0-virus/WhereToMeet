import type { Category, Hub, Origin, Place } from '../src/shared.ts';
import { ApiFailure } from './errors.ts';
function pause(ms:number,signal:AbortSignal):Promise<void> {
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(signal.reason);return;}
  const onAbort=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',onAbort);resolve();},ms);
  signal.addEventListener('abort',onAbort,{once:true});
 });
}
async function documents(path:string,params:Record<string,string>,key:string,signal:AbortSignal,fetchImpl:typeof fetch,deadlineMs:number):Promise<Record<string,unknown>[]> {
 if(!key)throw new ApiFailure('CONFIG_NOT_READY',503);
 const url=new URL(`https://dapi.kakao.com/v2/local/${path}.json`);for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 for(let attempt=0;attempt<2;attempt++){
  signal.throwIfAborted();let response:Response;
  try{response=await fetchImpl(url,{headers:{Authorization:`KakaoAK ${key}`},signal,redirect:'error'});}catch {if(signal.aborted)throw signal.reason;if(attempt===0)continue;throw new ApiFailure('PROVIDER_UNAVAILABLE',503);}
  if((response.status===429||response.status>=500)&&attempt===0){
   const retry=response.headers.get('retry-after');
   const wait=retry===null?(response.status===429?Infinity:0):/^\d+(?:\.\d+)?$/.test(retry)?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now());
   if(Number.isFinite(wait)&&wait>=0&&wait<deadlineMs-Date.now()-1){await response.body?.cancel();if(wait>0)await pause(wait,signal);continue;}
  }
  if(response.status===429)throw new ApiFailure('QUOTA_EXCEEDED',429);
  if(!response.ok)throw new ApiFailure('PROVIDER_ERROR',502);
  let data:any;try{data=await response.json();}catch{throw new ApiFailure('PROVIDER_ERROR',502);}
  if(!Array.isArray(data?.documents))throw new ApiFailure('PROVIDER_ERROR',502);return data.documents;
 }
 throw new ApiFailure('PROVIDER_UNAVAILABLE',503);
}
export async function verifyRegions(origins:Origin[],key:string,signal:AbortSignal,fetchImpl:typeof fetch=fetch,deadlineMs=Date.now()+30000):Promise<void> {
 const seen=new Set<string>();for(const origin of origins){const point=`${origin.lng},${origin.lat}`;if(seen.has(point))continue;seen.add(point);
  const rows=await documents('geo/coord2regioncode',{x:String(origin.lng),y:String(origin.lat),input_coord:'WGS84'},key,signal,fetchImpl,deadlineMs);
  if(!rows.some(d=>d.region_type==='B'&&typeof d.code==='string'&&/^(11|28|41)\d{8}$/.test(d.code)))throw new ApiFailure('INVALID_INPUT',400);
 }
}
function normalize(d:Record<string,unknown>):Place|null {
 if(typeof d.id!=='string'||!/^\d+$/.test(d.id)||typeof d.place_name!=='string'||typeof d.address_name!=='string'||typeof d.place_url!=='string')return null;
 let url:URL;try{url=new URL(d.place_url);}catch{return null;}
 if(!['http:','https:'].includes(url.protocol)||url.hostname!=='place.map.kakao.com'||url.port||url.username||url.password||url.pathname!==`/${d.id}`||url.search||url.hash)return null;
 const lat=Number(d.y),lng=Number(d.x);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<33||lat>39||lng<124||lng>132)return null;
 const distance=Number(d.distance);
 return {id:d.id,name:d.place_name.slice(0,200),lat,lng,address:d.address_name.slice(0,300),url:`https://place.map.kakao.com/${d.id}`,...(typeof d.category_name==='string'?{category:d.category_name.slice(0,200)}:{}),...(d.distance!==undefined&&Number.isFinite(distance)&&distance>=0?{distance}:{})};
}
export async function kakaoPlaces(mode:'search'|'nearby',input:{q?:string;hub?:Hub;category?:Category},key:string,signal:AbortSignal,fetchImpl:typeof fetch=fetch,deadlineMs=Date.now()+30000):Promise<Place[]> {
 const params={size:'15',page:'1'};let rows:Record<string,unknown>[];
 if(mode==='search')rows=await documents('search/keyword',{...params,query:input.q!},key,signal,fetchImpl,deadlineMs);
 else {
  const categories={restaurant:['FD6'],cafe:['CE7'],culture:['CT1','AT4']}[input.category!];rows=[];
  for(const category_group_code of categories)rows.push(...await documents('search/category',{...params,category_group_code,x:String(input.hub!.lng),y:String(input.hub!.lat),radius:'800',sort:'distance'},key,signal,fetchImpl,deadlineMs));
 }
 const result=rows.map(normalize).filter((p):p is Place=>p!==null).filter(p=>mode==='search'||(p.distance!==undefined&&p.distance<=800));
 const unique=[...new Map(result.map(p=>[p.id,p])).values()];if(mode==='nearby')unique.sort((a,b)=>(a.distance??0)-(b.distance??0)||a.id.localeCompare(b.id));return unique.slice(0,15);
}
