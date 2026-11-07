import {z} from 'zod';
import {authorizedOwner} from '@/lib/supabase/server';
import {getQuote} from '@/lib/market';
import {analyzeSymbol} from '@/lib/radar';
import {evaluateAlert,type AlertMetric} from '@/lib/alert-engine';
export const runtime='nodejs';export const maxDuration=60;
const schema=z.object({symbol:z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.\-]{0,11}$/),
 metric:z.enum(['price_above','price_below','daily_change_abs','volatility_above','volume_ratio_above']),
 threshold:z.number().finite().positive().max(100_000_000),enabled:z.boolean().optional()});
const auth=()=>authorizedOwner();
export async function GET(request:Request){
 const owner=await auth();if(!owner)return Response.json({error:'Owner login required'},{status:401});
 const {data,error}=await owner.db.from('watchlist_alert_rules').select('id,symbol,metric,threshold,enabled,created_at').eq('user_id',owner.user.id).order('created_at',{ascending:false}).limit(30);
 if(error)return Response.json({error:'Alert rules unavailable. Apply Phase 6 migration.'},{status:503});
 const rules=(data||[]).map(r=>({...r,threshold:Number(r.threshold),metric:r.metric as AlertMetric}));
 if(new URL(request.url).searchParams.get('evaluate')!=='true')
  return Response.json({rules,note:'Alert rules are checked on demand; no automatic notification delivery is configured.'},{headers:{'Cache-Control':'no-store'}});
 const observations=new Map<string,{symbol:string;price:number|null;changePercent:number|null;volatility20:number|null;volumeRatio:number|null;asOf:string|null}>();
 const errors:Record<string,string>={};
 const activeSymbols=[...new Set(rules.filter(r=>r.enabled).map(r=>r.symbol))].slice(0,4);
 for(let start=0;start<activeSymbols.length;start+=2){
 await Promise.all(activeSymbols.slice(start,start+2).map(async symbol=>{
  const needsHistorical=rules.some(r=>r.symbol===symbol&&r.enabled&&(r.metric==='volatility_above'||r.metric==='volume_ratio_above'));
  let price:number|null=null,changePercent:number|null=null,volatility20:number|null=null,volumeRatio:number|null=null,asOf:string|null=null;
  try{const q=await getQuote(symbol);price=q.price;changePercent=q.changePercent;asOf=q.asOf}
  catch(e){errors[symbol]=e instanceof Error?e.message:'Quote unavailable'}
  if(needsHistorical)try{
   const report=await analyzeSymbol(symbol);
   const v=report.metrics.find(m=>m.id==='volatility20')?.value;
   const ratio=report.metrics.find(m=>m.id==='volumeRatio')?.value;
   volatility20=typeof v==='number'?v:null;volumeRatio=typeof ratio==='number'?ratio:null;
   asOf=report.lastDate;
  }catch(e){errors[symbol]=[errors[symbol],e instanceof Error?e.message:'History unavailable'].filter(Boolean).join('; ')}
  observations.set(symbol,{symbol,price,changePercent,volatility20,volumeRatio,asOf});
 }));
 }
 const assessments=rules.map(r=>evaluateAlert(r,observations.get(r.symbol)??null));
 return Response.json({rules,assessments,errors,evaluatedAt:new Date().toISOString(),
  note:'On-demand snapshots only. No background monitoring, notifications, guaranteed current prices or automatic trading.'},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const owner=await auth();if(!owner)return Response.json({error:'Owner login required'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return Response.json({error:'Invalid rule parameters.'},{status:400});
 const {error}=await owner.db.from('watchlist_alert_rules').upsert({...parsed.data,user_id:owner.user.id},{onConflict:'user_id,symbol,metric'});
 return error?Response.json({error:'Could not save rule; apply Phase 6 migration.'},{status:503}):Response.json({saved:true},{status:201});
}
export async function DELETE(request:Request){
 const owner=await auth();if(!owner)return Response.json({error:'Owner login required'},{status:401});
 const id=new URL(request.url).searchParams.get('id');
 if(!id||!z.string().uuid().safeParse(id).success)return Response.json({error:'Invalid rule ID'},{status:400});
 const {error}=await owner.db.from('watchlist_alert_rules').delete().eq('user_id',owner.user.id).eq('id',id);
 return error?Response.json({error:'Delete failed'},{status:503}):Response.json({deleted:true});
}
