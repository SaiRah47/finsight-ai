import 'server-only';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {LEAGUE_SYMBOLS,simulateDiversifiedLeague} from './arena-diversified';
import {inspectHistory} from './market-quality';
import type {ReplayBar,ReplayDataset} from './arena-replay';
function admin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Simulation storage not configured.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function diversifiedCoverage(owner:string){
 const db=admin();
 const {data,error}=await db.from('market_dataset_snapshots')
  .select('id,symbol,dataset_sha256,observation_count,first_date,last_date,captured_at')
  .eq('user_id',owner).in('symbol',LEAGUE_SYMBOLS).order('captured_at',{ascending:false}).limit(120);
 if(error)throw Error('Versioned market archive unavailable.');
 return LEAGUE_SYMBOLS.map(symbol=>({symbol,archive:(data??[]).find(x=>x.symbol===symbol)??null}));
}
export async function diversifiedHistory(owner:string){
 const db=admin();
 const {data,error}=await db.from('arena_replay_runs')
  .select('id,run_key,start_date,end_date,sessions,symbols,created_at,result')
  .eq('user_id',owner).order('created_at',{ascending:false}).limit(40);
 if(error)throw Error('Simulation run storage unavailable.');
 return (data??[]).filter(x=>x.result?.version===2).slice(0,6);
}
export async function executeDiversifiedReplay(owner:string){
 const coverage=await diversifiedCoverage(owner);
 if(coverage.some(x=>!x.archive))throw Error('Archive all '+LEAGUE_SYMBOLS.length+' required datasets before running the multi-stock tournament.');
 const db=admin(),datasets:ReplayDataset[]=[];
 for(const row of coverage){
  const archive=row.archive!;
  const {data,error}=await db.from('market_dataset_snapshots')
   .select('id,symbol,dataset_sha256,payload')
   .eq('user_id',owner).eq('id',archive.id).single();
  if(error||!data)throw Error('Archived dataset unavailable for '+row.symbol);
  const payload=data.payload as {symbol?:unknown;interval?:unknown;currency?:unknown;bars?:unknown};
  if(payload.symbol!==row.symbol||payload.currency!=='USD'||payload.interval!=='1day'||!Array.isArray(payload.bars))
   throw Error('Only original USD daily OHLCV snapshots qualify for '+row.symbol);
  const bars=payload.bars as ReplayBar[];
  const quality=inspectHistory(bars);
  if(quality.issues.some(x=>x.severity==='error')||bars.length<60)
   throw Error('Invalid or insufficient OHLCV observations for '+row.symbol);
  if(!/^[a-f0-9]{64}$/.test(String(data.dataset_sha256)))throw Error('Snapshot fingerprint unavailable.');
  datasets.push({symbol:row.symbol,id:data.id,sha256:data.dataset_sha256,bars});
 }
 const result=simulateDiversifiedLeague(datasets);
 const runKey=createHash('sha256').update(JSON.stringify({engine:'diversified-league-v2',version:2,
  datasets:result.dataSources.map(x=>[x.symbol,x.datasetId,x.checksum])})).digest('hex');
 const record={user_id:owner,run_key:runKey,start_date:result.startDate,end_date:result.endDate,
  sessions:result.sessions,symbols:result.symbols,snapshot_ids:result.dataSources.map(x=>x.datasetId),result};
 const {data,error}=await db.from('arena_replay_runs').upsert(record,{onConflict:'user_id,run_key',ignoreDuplicates:true})
  .select('id,run_key,start_date,end_date,sessions,symbols,created_at,result').maybeSingle();
 if(error)throw Error('Simulation ledger save failed: '+error.message.slice(0,140));
 if(data)return data;
 const existing=await db.from('arena_replay_runs')
  .select('id,run_key,start_date,end_date,sessions,symbols,created_at,result')
  .eq('user_id',owner).eq('run_key',runKey).single();
 if(existing.error||!existing.data)throw Error('Could not load existing immutable tournament.');
 return existing.data;
}
