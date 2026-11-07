import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {getQuote} from './market';
import {reviewEquitySeries,type EquityObservation} from './arena-learning';
import type {SupabaseClient} from '@supabase/supabase-js';

function dbAdmin():SupabaseClient{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Server-only Supabase credentials are required.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
type SnapshotOutcome={agent:string;status:'recorded'|'already-recorded'|'skipped';observationDay:string|null;reason:string};
const marketDate=(value:string|null)=>value&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):null;
const isWeekday=(date:string)=>{const n=new Date(date+'T12:00:00Z').getUTCDay();return n>0&&n<6};
const validRecent=(date:string)=>{const age=Date.now()-new Date(date+'T12:00:00Z').getTime();return age>=-86400000&&age<5*86400000};

export async function recordArenaObservations(owner:string):Promise<{outcomes:SnapshotOutcome[];limitations:string[]}>{
 const db=dbAdmin();
 const {data:season,error:seasonError}=await db.from('arena_seasons').select('id').eq('user_id',owner).eq('name','Season 1').maybeSingle();
 if(seasonError||!season)throw Error('Initialize Arena Season 1 first.');
 const [agentsResponse,positionsResponse]=await Promise.all([
  db.from('arena_agents').select('id,slug,league,cash').eq('user_id',owner).eq('season_id',season.id),
  db.from('arena_positions').select('agent_id,symbol,shares').eq('user_id',owner)
 ]);
 if(agentsResponse.error||positionsResponse.error)throw Error('Arena positions or accounts unavailable.');
 const agents=(agentsResponse.data||[]).filter(x=>x.league==='investor');
 const positions=positionsResponse.data||[];
 const symbols=[...new Set(positions.filter(p=>Number(p.shares)>0).map(p=>String(p.symbol)))];
 const observed=new Map<string,{price:number;date:string}>();
 const failures=new Map<string,string>();
 for(let i=0;i<symbols.length;i+=3){
  await Promise.all(symbols.slice(i,i+3).map(async symbol=>{
   try{
    const quote=await getQuote(symbol),date=marketDate(quote.asOf);
    if(quote.currency!=='USD'||quote.price<=0||!date||!isWeekday(date)||!validRecent(date))
     throw Error('Positive USD quote with a recent exchange session date unavailable');
    observed.set(symbol,{price:quote.price,date});
   }catch(error){failures.set(symbol,error instanceof Error?error.message:'Quote unavailable')}
  }));
 }
 const outcomes:SnapshotOutcome[]=[];
 for(const agent of agents){
  const held=positions.filter(p=>p.agent_id===agent.id&&Number(p.shares)>0);
  if(!held.length){
   outcomes.push({agent:agent.slug,status:'skipped',observationDay:null,reason:'No positions yet; no market-day equity history fabricated.'});
   continue;
  }
  const missing=held.filter(p=>!observed.has(p.symbol));
  if(missing.length){
   outcomes.push({agent:agent.slug,status:'skipped',observationDay:null,reason:'Missing valid quotes: '+missing.map(p=>p.symbol).join(', ')});
   continue;
  }
  const days=[...new Set(held.map(p=>observed.get(p.symbol)!.date))];
  if(days.length!==1){
   outcomes.push({agent:agent.slug,status:'skipped',observationDay:null,reason:'Holding price dates do not align; no synthetic equity snapshot recorded.'});
   continue;
  }
  const day=days[0];
  const holdingsValue=held.reduce((total,p)=>total+Number(p.shares)*observed.get(p.symbol)!.price,0);
  const cash=Number(agent.cash);
  if(!Number.isFinite(cash)||cash<0||!Number.isFinite(holdingsValue)){
   outcomes.push({agent:agent.slug,status:'skipped',observationDay:day,reason:'Account cash or positions failed numeric validation.'});continue;
  }
  const {error}=await db.from('arena_equity_observations').insert({
   user_id:owner,season_id:season.id,agent_id:agent.id,observation_day:day,
   equity:Number((cash+holdingsValue).toFixed(4)),cash,holdings_value:Number(holdingsValue.toFixed(4)),
   position_count:held.length,source:'Twelve Data'
  });
  if(error&&error.code!=='23505'){
   outcomes.push({agent:agent.slug,status:'skipped',observationDay:day,reason:'Observation persistence failed: '+error.message.slice(0,150)});
  }else outcomes.push({agent:agent.slug,status:error?'already-recorded':'recorded',observationDay:day,
    reason:error?'Original immutable session observation retained.':'Quote-dated paper equity observation stored.'});
 }
 return {outcomes,limitations:[
  'Only complete, same-day USD quote coverage is accepted; cash-only agents and mixed-date holdings are skipped.',
  'At most one immutable observation per agent/exchange day. Capturing late cannot reconstruct a past fill or valuation.',
  'Provider prices can be delayed and do not include corporate actions, dividends, spread or all costs.'
 ]};
}

export async function reviewArena(owner:string){
 const db=dbAdmin();
 const {data:season,error:sError}=await db.from('arena_seasons').select('id').eq('user_id',owner).eq('name','Season 1').maybeSingle();
 if(sError||!season)throw Error('Initialize Arena Season 1 first.');
 const [agentsResponse,snapshotsResponse]=await Promise.all([
  db.from('arena_agents').select('id,slug,league').eq('user_id',owner).eq('season_id',season.id),
  db.from('arena_equity_observations').select('agent_id,observation_day,equity').eq('user_id',owner).eq('season_id',season.id).order('observation_day',{ascending:true}).limit(800)
 ]);
 if(agentsResponse.error||snapshotsResponse.error)throw Error('Apply the Phase 8 learning migration before reviewing strategies.');
 const reviewDay=new Date().toISOString().slice(0,10);
 const reports=[];
 for(const a of agentsResponse.data||[]){
  const series:EquityObservation[]=(snapshotsResponse.data||[]).filter(x=>x.agent_id===a.id)
   .map(x=>({day:String(x.observation_day),equity:Number(x.equity)}));
  const diagnostics=reviewEquitySeries(series);
  // Persist a research-only record; never write to arena_agents or strategy parameters.
  const {error}=await db.from('arena_learning_reviews').insert({
   user_id:owner,season_id:season.id,agent_id:a.id,review_day:reviewDay,verdict:diagnostics.verdict,
   diagnostics,proposed_change:diagnostics.candidateChange,status:'research-only'
  });
  if(error&&error.code!=='23505')throw Error('Could not save review: '+error.message);
  reports.push({agentId:a.id,slug:a.slug,league:a.league,diagnostics,stored:error?.code!=='23505'});
 }
 return {reports,reviewDay,limitations:[
  'Reviews identify possible shortcomings, not predictive winning strategies.',
  'Candidate parameter changes are research-only and never change the active paper strategy.',
  'Out-of-sample shadow evaluation, benchmark comparisons and explicit approval are required before any promotion.'
 ]};
}

export async function learningHistory(owner:string){
 const db=dbAdmin();
 const [samples,reviews]=await Promise.all([
  db.from('arena_equity_observations').select('agent_id,observation_day,equity,cash,holdings_value').eq('user_id',owner).order('observation_day',{ascending:true}).limit(800),
  db.from('arena_learning_reviews').select('agent_id,review_day,verdict,diagnostics,proposed_change,status,created_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(40)
 ]);
 if(samples.error||reviews.error)throw Error('Learning history unavailable. Apply Phase 8 learning migration.');
 return {observations:samples.data||[],reviews:reviews.data||[],note:'Immutable source-dated equity history and research-only agent reviews; no strategies automatically change.'};
}
