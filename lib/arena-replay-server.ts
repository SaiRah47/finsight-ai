import 'server-only';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {simulateTournament,REPLAY_PROXIES,type ReplayDataset,type ReplayBar} from './arena-replay';
import {inspectHistory} from './market-quality';
function admin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Historical paper tournament requires server credentials.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function replayHistory(owner:string){
 const db=admin();
 const {data,error}=await db.from('arena_replay_runs').select('id,run_key,start_date,end_date,sessions,symbols,created_at,result')
  .eq('user_id',owner).order('created_at',{ascending:false}).limit(40);
 if(error)throw Error('Simulation history unavailable. Apply Phase 11 migration.');
 return (data??[]).filter(x=>x.result?.version!==2).slice(0,8);
}
export async function replayCoverage(owner:string){
 const db=admin();
 const symbols=REPLAY_PROXIES.map(x=>x.symbol);
 const {data,error}=await db.from('market_dataset_snapshots').select('id,symbol,observation_count,last_date,quality,dataset_sha256,captured_at')
  .eq('user_id',owner).in('symbol',symbols).order('captured_at',{ascending:false}).limit(100);
 if(error)throw Error('Could not load archived market datasets.');
 return REPLAY_PROXIES.map(proxy=>({proxy,...proxy,archive:(data??[]).find(x=>x.symbol===proxy.symbol)??null}));
}
export async function runHistoricalTournament(owner:string){
 const db=admin();const datasets:ReplayDataset[]=[];
 const coverage=await replayCoverage(owner);
 if(coverage.some(x=>!x.archive))throw Error('Archive the four representative ticker datasets before running the tournament.');
 for(const item of coverage){
  const {data,error}=await db.from('market_dataset_snapshots')
   .select('id,symbol,dataset_sha256,payload,quality')
   .eq('user_id',owner).eq('id',item.archive!.id).single();
  if(error||!data)throw Error('Versioned market data unavailable for '+item.symbol);
  const payload=data.payload as {symbol?:unknown;currency?:unknown;interval?:unknown;bars?:unknown};
  if(payload.symbol!==item.symbol||payload.currency!=='USD'||payload.interval!=='1day'||!Array.isArray(payload.bars))
   throw Error('Replay requires USD daily archived observations for '+item.symbol);
  const bars=payload.bars as ReplayBar[];
  const quality=inspectHistory(bars);
  if(quality.issues.some(x=>x.severity==='error'))throw Error('Archived prices failed integrity checks for '+item.symbol);
  // The recorded provider snapshot checksum was computed before JSONB normalization.
  // Rehashing JSONB text would yield a different key order; preserve the stored identity.
  if(!/^[0-9a-f]{64}$/.test(String(data.dataset_sha256)))throw Error('Missing snapshot fingerprint.');
  datasets.push({id:data.id,symbol:item.symbol,sha256:data.dataset_sha256,bars});
 }
 const result=simulateTournament(datasets);
 const runKey=createHash('sha256').update(JSON.stringify({
  version:1,methodology:result.methodology,snapshots:datasets.map(x=>[x.id,x.sha256])
 })).digest('hex');
 const record={user_id:owner,run_key:runKey,start_date:result.startDate,end_date:result.endDate,
  sessions:result.sessions,symbols:result.symbols,snapshot_ids:datasets.map(x=>x.id),result};
 const {data,error}=await db.from('arena_replay_runs').upsert(record,{onConflict:'user_id,run_key',ignoreDuplicates:true})
  .select('id,run_key,start_date,end_date,sessions,symbols,created_at,result').maybeSingle();
 if(error)throw Error('Simulation result could not be persisted: '+error.message.slice(0,120));
 if(data)return data;
 const old=await db.from('arena_replay_runs').select('id,run_key,start_date,end_date,sessions,symbols,created_at,result')
  .eq('user_id',owner).eq('run_key',runKey).single();
 if(old.error||!old.data)throw Error('Saved simulation result could not be found.');
 return old.data;
}
