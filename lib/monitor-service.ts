import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {getQuote} from './market';
import {analyzeSymbol} from './radar';
import {getCompanyFilings} from './sec';
import {transitionRule,classifyFilings} from './monitoring-rules';
import type {AlertMetric,AlertObservation,AlertRule} from './alert-engine';

type ScanSummary={runId:string|null;status:'disabled'|'duplicate'|'completed'|'partial'|'failed';symbols:number;created:number;errors:string[]};
function adminDb(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('SUPABASE_SECRET_KEY and Supabase URL must be configured for unattended monitoring.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
const safeError=(e:unknown)=>e instanceof Error?e.message.slice(0,180):'Unknown provider failure';
export async function scanOwnerMonitoring():Promise<ScanSummary>{
 const startedAt=Date.now();
 const db=adminDb(),userId=process.env.FINSIGHT_OWNER_USER_ID;
 if(!userId)throw Error('FINSIGHT_OWNER_USER_ID is required.');
 const {data:settings,error:se}=await db.from('monitor_settings').select('enabled,email_enabled,filings_enabled').eq('user_id',userId).maybeSingle();
 if(se)throw Error('Monitoring migration unavailable: '+se.message);
 if(!settings?.enabled)return {runId:null,status:'disabled',symbols:0,created:0,errors:[]};
 const prefs=settings;
 const day=new Date().toISOString().slice(0,10);
 // Unique per-owner/day row is an atomic, database-level claim that prevents duplicate cron invocations.
 const {data:run,error:re}=await db.from('monitor_runs').insert({user_id:userId,run_day:day,status:'running'}).select('id').single();
 if(re){
  if(re.code==='23505')return {runId:null,status:'duplicate',symbols:0,created:0,errors:[]};
  throw Error('Unable to acquire daily monitor run: '+re.message);
 }
 const runId=String(run.id),errors:string[]=[];
 let created=0,symbolCount=0;
 async function emit(kind:'threshold'|'filing',eventKey:string,symbol:string,title:string,details:string,observation_at:string|null,source_url:string|null){
  const key=kind+':'+eventKey;
  const {error}=await db.from('monitor_events').insert({
   user_id:userId,run_id:runId,event_key:key,kind,symbol,title,details,observation_at,source_url,
   email_status:prefs.email_enabled?'pending':'not_requested'
  });
  if(!error){created++;return true}
  if(error.code==='23505')return true; // Already recorded by a previous attempt.
  errors.push('Event persistence: '+error.message.slice(0,100));
  return false;
 }
 try{
  const {data:rules,error:ruleError}=await db.from('watchlist_alert_rules').select('id,symbol,metric,threshold,enabled').eq('user_id',userId).eq('enabled',true).order('created_at',{ascending:false}).limit(30);
  if(ruleError)throw Error('Could not load rules: '+ruleError.message);
  const active=(rules||[]).map(r=>({id:String(r.id),symbol:String(r.symbol),metric:r.metric as AlertMetric,threshold:Number(r.threshold),enabled:Boolean(r.enabled)}));
  // Bound daily market provider work: up to three distinct symbols, no more than 2 concurrent calls.
  const symbols=[...new Set(active.map(r=>r.symbol))].slice(0,3);
  symbolCount=0;
  const {data:prior,error:priorError}=await db.from('monitor_rule_state').select('rule_id,triggered').eq('user_id',userId);
  if(priorError)throw Error('Rule-state query unavailable: '+priorError.message);
  const previous=new Map((prior||[]).map(x=>[String(x.rule_id),Boolean(x.triggered)]));
  for(const symbol of symbols){
   if(Date.now()-startedAt>30_000){errors.push('Daily market scan stopped at 30-second soft budget; remaining symbols deferred.');break}
   symbolCount++;
   const selected=active.filter(r=>r.symbol===symbol);
   const historical=selected.some(r=>r.metric==='volatility_above'||r.metric==='volume_ratio_above');
   const observation:AlertObservation={symbol,price:null,changePercent:null,volatility20:null,volumeRatio:null,asOf:null};
   try{
    const quote=await getQuote(symbol);
    observation.price=quote.price;observation.changePercent=quote.changePercent;observation.asOf=quote.asOf;
   }catch(e){errors.push(symbol+' quote: '+safeError(e))}
   let historyDate:string|null=null;
   if(historical)try{
    const report=await analyzeSymbol(symbol);
    observation.volatility20=report.metrics.find(m=>m.id==='volatility20')?.value??null;
    observation.volumeRatio=report.metrics.find(m=>m.id==='volumeRatio')?.value??null;
    historyDate=report.lastDate;
   }catch(e){errors.push(symbol+' history: '+safeError(e))}
   for(const rule of selected){
    const isHistorical=rule.metric==='volatility_above'||rule.metric==='volume_ratio_above';
    const dated={...observation,asOf:isHistorical?historyDate:observation.asOf};
    const next=transitionRule(rule,dated,previous.get(rule.id)||false);
    if(next.observation===null||!Number.isFinite(rule.threshold)){
     errors.push(symbol+' '+rule.metric+': no dated observation, preserving state');
     continue;
    }
    if(next.emit){
     const metric=rule.metric.replaceAll('_',' ');
     const stored=await emit('threshold',rule.id+':'+next.observation,symbol,
      symbol+' '+metric+' threshold exceeded',
      'Threshold '+rule.threshold+'; provider observation: '+next.observation+'. '+next.reason,next.observation,null);
     if(!stored)continue; // Do not lose the event by advancing its trigger state.
    }
    const {error:stateError}=await db.from('monitor_rule_state').upsert({
     user_id:userId,rule_id:rule.id,triggered:next.triggered,last_observation:next.observation,updated_at:new Date().toISOString()
    },{onConflict:'user_id,rule_id'});
    if(stateError)errors.push('Rule state persistence: '+stateError.message.slice(0,100));
   }
  }
  if(prefs.filings_enabled&&Date.now()-startedAt<=37_000){
   const {data:watch,error:watchError}=await db.from('watchlist_symbols').select('symbol').eq('user_id',userId).order('created_at',{ascending:false}).limit(2);
   if(watchError)errors.push('SEC watchlist lookup: '+watchError.message.slice(0,100));
   else for(const row of watch||[]){
    if(Date.now()-startedAt>44_000){errors.push('SEC monitoring stopped at 44-second soft budget.');break}
    const symbol=String(row.symbol);
    try{
     const company=await getCompanyFilings(symbol,{includeFacts:false});
     const recent=company.filings.slice(0,12);
     if(!recent.length)continue;
     const {data:state,error:stateError}=await db.from('monitor_filing_state').select('last_accession').eq('user_id',userId).eq('symbol',symbol).maybeSingle();
     if(stateError){errors.push('SEC baseline read: '+stateError.message.slice(0,100));continue}
     const discovery=classifyFilings(recent.map(f=>f.accession),state?.last_accession??null);
     let storedAll=true;
     for(const accession of discovery.newAccessions.slice(0,3)){
      const filing=recent.find(f=>f.accession===accession);
      if(!filing)continue;
      const stored=await emit('filing',symbol+':'+accession,symbol,
       symbol+' filed SEC '+filing.form,'Official SEC '+filing.form+' filed '+filing.filed+'.',filing.filed,filing.url);
      if(!stored)storedAll=false;
     }
     if(storedAll&&discovery.nextLastSeen&&(discovery.nextLastSeen!==state?.last_accession)){
      const {error:e}=await db.from('monitor_filing_state').upsert({user_id:userId,symbol,last_accession:discovery.nextLastSeen,updated_at:new Date().toISOString()},{onConflict:'user_id,symbol'});
      if(e)errors.push('SEC baseline persistence: '+e.message.slice(0,100));
     }
    }catch(e){errors.push(symbol+' SEC: '+safeError(e))}
   }
  }else if(prefs.filings_enabled){errors.push('SEC monitoring deferred because the market scan reached the daily execution budget.')}
 }catch(e){errors.push(safeError(e))}
 const status=errors.length?'partial':'completed';
 await db.from('monitor_runs').update({status,completed_at:new Date().toISOString(),symbols_scanned:symbolCount,events_created:created,error_text:errors.slice(0,6).join('; ').slice(0,1000)||null}).eq('id',runId).eq('user_id',userId);
 return {runId,status,symbols:symbolCount,created,errors};
}
