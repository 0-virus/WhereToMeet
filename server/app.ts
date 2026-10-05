import type { Catalog, Category, Hub, Recommendation, RecommendRequest, RecommendResponse } from '../src/shared.ts';
import { ApiFailure, safeFailure } from './errors.ts';
import { anonymousIdentity, deleteExpiredHistory, deleteHistory, getHistory, listHistory, saveHistory, setBookmarks } from './history.ts';
import { kakaoPlaces, verifyRegions } from './kakao.ts';
import { reserveQuota } from './quota.ts';
import { deleteExpiredSearchEvents, queueSearchEvent } from './search-events.ts';
import type { SearchEvent } from './search-events.ts';
import { readJson, validId, validateRecommendation } from './validation.ts';

export type Env={DB:D1Database;ASSETS?:Fetcher;ENVIRONMENT?:string;KAKAO_REST_API_KEY?:string;TRAVELTIME_APP_ID?:string;TRAVELTIME_API_KEY?:string;ROUTING_APPROVED?:string;TRAVELTIME_HITS_PER_MINUTE?:string;TRAVELTIME_HITS_PER_SEARCH?:string;MAX_CONCURRENT_SEARCHES?:string;RATE_LIMITER?:{limit:(input:{key:string})=>Promise<{success:boolean}>}};
type EngineOptions={signal:AbortSignal;maxHits:number;beforeRequest:(hits:number)=>Promise<void>;appId:string;apiKey:string;fetchImpl:typeof fetch;now:()=>number};
export type WorkerDependencies={catalog:Catalog;fetchImpl?:typeof fetch;now?:()=>number;budgetMs?:number;recommendImpl?:(input:RecommendRequest,hubs:Hub[],options:EngineOptions)=>Promise<Recommendation[]>};
type Context=Pick<ExecutionContext,'waitUntil'>;
export function createWorker(deps:WorkerDependencies) {
 const now=deps.now??Date.now;const fetchImpl=deps.fetchImpl??fetch;const catalog=deps.catalog;
 const findHub=(id:string)=>catalog.hubs.find(h=>h.id===id&&h.verified);
 const catalogReady=()=>{if(!catalog.hubs.length||catalog.hubs.some(h=>!h.verified))throw new ApiFailure('CATALOG_NOT_READY',503);};
 return {
 async fetch(request:Request,env:Env,ctx:Context):Promise<Response> {
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
  const requestId=crypto.randomUUID();const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  const json=(body:unknown,status=200)=>new Response(status===204?null:JSON.stringify(body),{status,headers});
  const controller=new AbortController();const check=()=>{if(controller.signal.aborted)throw controller.signal.reason;};
  const cancel=()=>controller.abort(new ApiFailure('CANCELLED',499));request.signal.addEventListener('abort',cancel,{once:true});if(request.signal.aborted)cancel();
  const timer=setTimeout(()=>controller.abort(new ApiFailure('TIMEOUT',504)),deps.budgetMs??30000);
  const deadlineMs=Date.now()+(deps.budgetMs??30000);
  let event:SearchEvent|undefined;let hits=()=>0;let release:(()=>Promise<void>)|undefined;
  const started=now();
  try {
   const task=async()=>{
    check();
    if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)throw new ApiFailure('FORBIDDEN',403);
    if(request.headers.get('sec-fetch-site')==='cross-site')throw new ApiFailure('FORBIDDEN',403);
    if(env.ENVIRONMENT==='production'&&!env.RATE_LIMITER&&(url.pathname.startsWith('/api/places/')||url.pathname==='/api/recommendations'))throw new ApiFailure('CONFIG_NOT_READY',503);
    if(env.RATE_LIMITER){
     // Ephemeral abuse protection key; never put raw IP in D1, logs, or binding keys.
     const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${new Date(now()).toISOString().slice(0,10)}:${request.headers.get('CF-Connecting-IP')??'unknown'}`));
     const key=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
     const result=await env.RATE_LIMITER.limit({key});check();if(!result.success)throw new ApiFailure('QUOTA_EXCEEDED',429);
    }
    if(url.pathname==='/api/places/search'&&request.method==='GET') {
     const q=url.searchParams.get('q')?.trim();if(!q||q.length<2||q.length>100)throw new ApiFailure('INVALID_INPUT',400);
     return json({places:await kakaoPlaces('search',{q},env.KAKAO_REST_API_KEY??'',controller.signal,fetchImpl,deadlineMs)});
    }
    if(url.pathname==='/api/places/nearby'&&request.method==='GET') {
     catalogReady();const hub=findHub(url.searchParams.get('hubId')??'');const category=url.searchParams.get('category') as Category;
     if(!hub||!['restaurant','cafe','culture'].includes(category))throw new ApiFailure('INVALID_INPUT',400);
     return json({places:await kakaoPlaces('nearby',{hub,category},env.KAKAO_REST_API_KEY??'',controller.signal,fetchImpl,deadlineMs)});
    }
    const hubPath=url.pathname.match(/^\/api\/hubs\/([A-Za-z0-9_-]{1,100})$/);
    if(hubPath&&request.method==='GET'){catalogReady();const hub=findHub(hubPath[1]);if(!hub)throw new ApiFailure('NOT_FOUND',404);return json({hub});}
    if(url.pathname==='/api/recommendations'&&request.method==='POST') {
     const input=validateRecommendation(await readJson(request),now());check();
     const identity=await anonymousIdentity(request);check();if(identity.cookie)headers.set('Set-Cookie',identity.cookie);
     if(input.historyId){let owned;try{owned=await getHistory(env.DB,identity.owner,input.historyId,now());}catch{throw new ApiFailure('STORAGE_UNAVAILABLE',503);}check();if(!owned)throw new ApiFailure('NOT_FOUND',404);}
     catalogReady();if(env.ROUTING_APPROVED!=='true')throw new ApiFailure('ROUTING_NOT_READY',503);
     if(!env.DB||!env.KAKAO_REST_API_KEY||!env.TRAVELTIME_APP_ID||!env.TRAVELTIME_API_KEY)throw new ApiFailure('CONFIG_NOT_READY',503);
     const limits={hitsPerMinute:Number(env.TRAVELTIME_HITS_PER_MINUTE),hitsPerSearch:Number(env.TRAVELTIME_HITS_PER_SEARCH),maxConcurrent:Number(env.MAX_CONCURRENT_SEARCHES)};
     if(Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<=0)||limits.hitsPerSearch>limits.hitsPerMinute)throw new ApiFailure('CONFIG_NOT_READY',503);
     await verifyRegions(input.origins,env.KAKAO_REST_API_KEY,controller.signal,fetchImpl,deadlineMs);check();
     const quota=await reserveQuota(env.DB,requestId,identity.owner,limits,now());release=quota.release;check();
     event={requestId,searchedAt:new Date(now()).toISOString(),participantCount:input.origins.length,status:'error',errorCode:'INTERNAL_ERROR',recommendedHubIds:[],traveltimeHits:0,durationMs:0,algorithmVersion:'forward-isochrone-v1',dataVersion:catalog.version};
     const options:EngineOptions={appId:env.TRAVELTIME_APP_ID,apiKey:env.TRAVELTIME_API_KEY,signal:controller.signal,maxHits:limits.hitsPerSearch,now,fetchImpl,beforeRequest:async(n)=>{check();await quota.beforeRequest(n);check();}};
     let recommendations:Recommendation[];
     if(deps.recommendImpl)recommendations=await deps.recommendImpl(input,catalog.hubs,options);
     else {
      const [{createTravelTimeProvider},{recommend}]=await Promise.all([import('./travel-time.ts'),import('./recommend.ts')]);check();
      const provider=createTravelTimeProvider(options);hits=()=>provider.hits;recommendations=await recommend(input,catalog.hubs,provider);
     }
     check();
     const response:RecommendResponse={status:recommendations.length?'success':'no_routes',recommendations:recommendations.slice(0,4).map(r=>({...r,hub:findHub(r.hubId)})),requestId,calculatedAt:new Date(now()).toISOString(),dataVersion:catalog.version};
     event.status=response.status;event.errorCode=null;event.recommendedHubIds=response.recommendations.map(r=>r.hubId);event.durationMs=Math.max(0,now()-started);
     try{check();response.historyId=await saveHistory(env.DB,identity.owner,input,now());response.historySaved=true;}catch(error){check();response.historySaved=false;response.warning='검색 결과를 기록에 저장하지 못했습니다.';console.warn(JSON.stringify({code:'HISTORY_WRITE_FAILED',requestId}));}
     check();return json(response);
    }
    const historyPath=url.pathname.match(/^\/api\/history(?:\/([A-Za-z0-9_-]{1,100})(\/bookmarks)?)?$/);
    if(historyPath){
     const [,id,bookmarks]=historyPath;const identity=await anonymousIdentity(request);check();if(identity.cookie)headers.set('Set-Cookie',identity.cookie);
     if(!env.DB)throw new ApiFailure('STORAGE_UNAVAILABLE',503);
     const decorate=(record:any)=>record?{...record,bookmarkedHubs:record.bookmarkedHubIds.map(findHub).filter(Boolean)}:null;
     try{
      if(request.method==='GET'&&!bookmarks){if(!id)return json({history:(await listHistory(env.DB,identity.owner,now())).map(decorate)});const record=await getHistory(env.DB,identity.owner,id,now());if(!record)throw new ApiFailure('NOT_FOUND',404);return json({record:decorate(record)});}
      if(request.method==='DELETE'&&!bookmarks){await deleteHistory(env.DB,identity.owner,id);return json(null,204);}
      if(request.method==='PATCH'&&id&&bookmarks){const body=await readJson(request) as any;check();if(!Array.isArray(body?.hubIds)||new Set(body.hubIds).size!==body.hubIds.length||body.hubIds.some((id:unknown)=>!validId(id)))throw new ApiFailure('INVALID_INPUT',400);
       const owned=await getHistory(env.DB,identity.owner,id,now());if(!owned)throw new ApiFailure('NOT_FOUND',404);
       // Retired bookmarked hubs may be removed even if absent from the current catalog.
       if(body.hubIds.some((hubId:string)=>!findHub(hubId)&&!owned.bookmarkedHubIds.includes(hubId)))throw new ApiFailure('INVALID_INPUT',400);
       return json({record:decorate(await setBookmarks(env.DB,identity.owner,id,body.hubIds,now()))});}
     }catch(error){if(error instanceof ApiFailure)throw error;throw new ApiFailure('STORAGE_UNAVAILABLE',503);}
    }
    throw new ApiFailure('NOT_FOUND',404);
   };
   const abort=new Promise<never>((_,reject)=>{if(controller.signal.aborted)reject(controller.signal.reason);else controller.signal.addEventListener('abort',()=>reject(controller.signal.reason),{once:true});});
   return await Promise.race([task(),abort]);
  }catch(error){
   const failure=safeFailure(controller.signal.aborted?controller.signal.reason:error);
   if(event){event.status=failure.code==='CANCELLED'?'cancelled':'error';event.errorCode=failure.code;event.recommendedHubIds=[];}
   if(failure.status===429)headers.set('Retry-After','90');
   return json({error:{code:failure.code,message:failure.message,requestId,...(failure.status===429?{retryAfter:90}:{})}},failure.status);
  }finally{
   clearTimeout(timer);request.signal.removeEventListener('abort',cancel);
   if(event){event.traveltimeHits=hits();if(!event.durationMs)event.durationMs=Math.max(0,now()-started);queueSearchEvent(ctx,env.DB,event);}
   if(release)ctx.waitUntil(release().catch(()=>{console.warn(JSON.stringify({code:'QUOTA_RELEASE_FAILED',requestId}));}));
  }
 },
 async scheduled(_event:unknown,env:Env,ctx:Context):Promise<void> {
  const current=now();
  ctx.waitUntil(deleteExpiredSearchEvents(env.DB,new Date(current-90*86400000).toISOString()).catch(()=>{console.warn(JSON.stringify({code:'SEARCH_EVENT_CLEANUP_FAILED'}));}));
  ctx.waitUntil(deleteExpiredHistory(env.DB,current).catch(()=>{console.warn(JSON.stringify({code:'HISTORY_CLEANUP_FAILED'}));}));
  ctx.waitUntil(env.DB.prepare('DELETE FROM quota_reservations WHERE expires_at <= ?').bind(current).run().catch(()=>{console.warn(JSON.stringify({code:'QUOTA_CLEANUP_FAILED'}));}));
 }
 };
}
