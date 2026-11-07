import {authorizedOwner} from '@/lib/supabase/server';
export const runtime='nodejs';
const quantile=(arr:number[],p:number)=>{if(!arr.length)return null;const s=[...arr].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor((s.length-1)*p))]};
export async function GET(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const [traces,results,reviews]=await Promise.all([
  owner.db.from('execution_traces').select('events,created_at').eq('user_id',owner.user.id).order('created_at',{ascending:false}).limit(100),
  owner.db.from('research_runs').select('route,created_at').eq('user_id',owner.user.id).order('created_at',{ascending:false}).limit(100),
  owner.db.from('research_evaluations').select('kind,verdict').eq('user_id',owner.user.id).limit(100)
 ]);
 const samples:Record<string,number[]>={},errors:Record<string,number>={},statuses:Record<string,number>={};
 let sourceBearing=0,totalRuns=0;
 for(const row of traces.data||[]){
  const events=Array.isArray(row.events)?row.events:[];
  totalRuns++;
  if(events.some((e:unknown)=>typeof e==='object'&&e!==null&&!Array.isArray(e)&&(e as Record<string,unknown>).step==='evidence'&&Number((e as Record<string,unknown>).sourceCount)>0))sourceBearing++;
  for(const event of events){
   if(!event||typeof event!=='object'||Array.isArray(event))continue;
   const e=event as Record<string,unknown>,step=typeof e.step==='string'?e.step:'unknown',status=typeof e.status==='string'?e.status:'unknown';
   statuses[status]=(statuses[status]||0)+1;
   if(status==='error'||status==='unavailable')errors[step]=(errors[step]||0)+1;
   if(status==='complete'&&typeof e.durationMs==='number'&&e.durationMs>=0&&e.durationMs<180000)
    (samples[step]??=[]).push(e.durationMs);
  }
 }
 const perNode=Object.entries(samples).map(([node,times])=>({node,samples:times.length,p50Ms:quantile(times,0.5),p95Ms:quantile(times,0.95),failures:errors[node]||0}));
 const reviewRows=reviews.data||[];
 return Response.json({
  runs:results.data?.length||0,traces:totalRuns,sourceBearing,
  sourceCoverage:totalRuns?Number((sourceBearing/totalRuns).toFixed(3)):null,
  statuses,perNode,failures:errors,
  reviews:{count:reviewRows.length,supported:reviewRows.filter(r=>r.verdict==='supported').length,
   unsupported:reviewRows.filter(r=>r.verdict==='unsupported').length,uncertain:reviewRows.filter(r=>r.verdict==='uncertain').length},
  limitations:[
   'Last 100 owner-accessible runs/traces only, not global application telemetry.',
   'p50/p95 are rough sample percentiles; no latency SLA or throughput guarantee.',
   'Only completed requests that saved traces are visible; missing/failed persistence may bias counts.',
   ...(reviews.error?['Review table unavailable until the Phase 5 Supabase migration is applied.']:[])
  ],
  generatedAt:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
