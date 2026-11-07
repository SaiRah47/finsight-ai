import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {getQuote} from './market';
import {eligiblePaperQuote} from './arena-session';
import {strategyFor,selectInvestorCandidate} from './arena-strategies';
import {simulateShadowBuy,valueShadowBook,compareShadowMarks,type VariantBook,type ShadowMark} from './arena-evolution';

function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Owner-only server database credentials are missing.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
const errorText=(error:unknown)=>error instanceof Error?error.message:'Shadow tournament operation failed';
type Version={id:string;agent_id:string;version:number;allocation:number;kind:string};
type Experiment={id:string;user_id:string;agent_id:string;baseline_version_id:string;candidate_version_id:string;
 baseline_cash:number;candidate_cash:number;baseline_positions:Record<string,{shares:number;averageCost:number}>;
 candidate_positions:Record<string,{shares:number;averageCost:number}>;cycle_counter:number;status:string;started_at:string};

async function getSeason(db:ReturnType<typeof database>,owner:string){
 const {data,error}=await db.from('arena_seasons').select('id,status').eq('user_id',owner).eq('name','Season 1').maybeSingle();
 if(error||!data)throw Error('Initialize Season 1 and apply the shadow-tournament migration.');
 return data;
}
export async function evolutionHistory(owner:string){
 const db=database();
 const [versions,controls,experiments,steps,changes]=await Promise.all([
  db.from('arena_strategy_versions').select('id,agent_id,version,allocation,kind,created_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(150),
  db.from('arena_strategy_control').select('agent_id,active_version_id,previous_version_id,updated_at').eq('user_id',owner).limit(12),
  db.from('arena_shadow_experiments').select('id,agent_id,baseline_version_id,candidate_version_id,baseline_cash,candidate_cash,baseline_positions,candidate_positions,cycle_counter,status,started_at').eq('user_id',owner).order('started_at',{ascending:false}).limit(24),
  db.from('arena_shadow_steps').select('experiment_id,observation_day,symbol,reference_price,baseline_fill,candidate_fill,baseline_equity,candidate_equity').eq('user_id',owner).order('observation_day',{ascending:true}).limit(500),
  db.from('arena_strategy_changes').select('id,agent_id,experiment_id,from_version_id,to_version_id,action,note,created_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(40)
 ]);
 if([versions,controls,experiments,steps,changes].some(x=>x.error))throw Error('Apply supabase/migrations/202611070007_phase8_shadow_tournaments.sql first.');
 const groups=(experiments.data||[]).map(x=>{
  const marks:ShadowMark[]=(steps.data||[]).filter(step=>step.experiment_id===x.id)
   .map(step=>({day:String(step.observation_day),baselineEquity:Number(step.baseline_equity),candidateEquity:Number(step.candidate_equity)}));
  return {...x,baseline_cash:Number(x.baseline_cash),candidate_cash:Number(x.candidate_cash),
   comparison:compareShadowMarks(marks),steps:marks.slice(-30)};
 });
 return {versions:(versions.data||[]).map(v=>({...v,allocation:Number(v.allocation)})),controls:controls.data||[],
  experiments:groups,changes:changes.data||[],
  methodology:'All shadow accounts start separately at $5,000, receive identical actual quote observations and use modeled 10bps buy slippage. No paper orders are sent to the real strategy account.'};
}
async function getOrCreateControl(db:ReturnType<typeof database>,owner:string,agentId:string){
 const {data:control,error:controlError}=await db.from('arena_strategy_control').select('active_version_id,previous_version_id').eq('agent_id',agentId).eq('user_id',owner).maybeSingle();
 if(controlError)throw Error(controlError.message);
 if(control)return control;
 const {data:baseline,error:baseError}=await db.from('arena_strategy_versions').upsert({
  user_id:owner,agent_id:agentId,version:1,allocation:0.20,kind:'baseline'
 },{onConflict:'agent_id,version',ignoreDuplicates:true}).select('id').maybeSingle();
 if(baseError&&baseError.code!=='23505')throw Error('Unable to initialize strategy version: '+baseError.message);
 let id=baseline?.id;
 if(!id){
  const existing=await db.from('arena_strategy_versions').select('id').eq('agent_id',agentId).eq('version',1).single();
  if(existing.error||!existing.data)throw Error('Could not retrieve baseline version.');
  id=existing.data.id;
 }
 const {error}=await db.from('arena_strategy_control').insert({agent_id:agentId,user_id:owner,active_version_id:id});
 if(error&&error.code!=='23505')throw Error('Could not establish version control: '+error.message);
 const latest=await db.from('arena_strategy_control').select('active_version_id,previous_version_id').eq('agent_id',agentId).eq('user_id',owner).single();
 if(latest.error||!latest.data)throw Error('Version control is unavailable.');
 return latest.data;
}
export async function createShadowExperiment(owner:string,agentId:string,allocation:number){
 if(!Number.isFinite(allocation)||allocation<0.05||allocation>0.25||Math.abs(allocation*100-Math.round(allocation*100))>1e-7)
  throw Error('Candidate allocation must be from 5% to 25% in whole percentage points.');
 const db=database(),season=await getSeason(db,owner);
 if(season.status!=='active')throw Error('Season 1 is closed.');
 const {data:agent,error:ae}=await db.from('arena_agents').select('id,slug,league,status,season_id').eq('id',agentId).eq('user_id',owner).eq('season_id',season.id).single();
 if(ae||!agent||agent.league!=='investor'||agent.status!=='active'||!strategyFor(agent.slug)?.enabled)
  throw Error('Only active Investor League agents may enter shadow tournaments.');
 const control=await getOrCreateControl(db,owner,agentId);
 const {data:active,error:ve}=await db.from('arena_strategy_versions').select('id,version,allocation').eq('id',control.active_version_id).eq('agent_id',agentId).single();
 if(ve||!active)throw Error('Current active version unavailable.');
 if(Math.abs(Number(active.allocation)-allocation)<0.0001)throw Error('Candidate allocation must differ from the active strategy allocation.');
 const {data:already}=await db.from('arena_shadow_experiments').select('id').eq('agent_id',agentId).eq('user_id',owner).eq('status','active').maybeSingle();
 if(already)throw Error('This agent already has an active shadow tournament. Finish it before starting another.');
 const {data:versions,error:historyError}=await db.from('arena_strategy_versions').select('version').eq('agent_id',agentId);
 if(historyError)throw Error('Could not read strategy version history.');
 const nextVersion=Math.max(1,...(versions||[]).map(v=>Number(v.version)))+1;
 if(nextVersion>99)throw Error('Version capacity reached.');
 const {data:candidate,error:ce}=await db.from('arena_strategy_versions').insert({
  user_id:owner,agent_id:agentId,version:nextVersion,allocation,kind:'candidate'
 }).select('id').single();
 if(ce||!candidate)throw Error('Could not create candidate strategy version.');
 const {data:experiment,error:ee}=await db.from('arena_shadow_experiments').insert({
  user_id:owner,agent_id:agentId,baseline_version_id:active.id,candidate_version_id:candidate.id
 }).select('id').single();
 if(ee||!experiment)throw Error('Could not initialize independent shadow books. Existing strategy was not changed.');
 return {experimentId:experiment.id,baselineVersion:active.version,candidateVersion:nextVersion,
  note:'Two independent $5,000 shadow books created. Existing Season 1 paper account is untouched.'};
}
export async function stepShadowExperiment(owner:string,experimentId:string){
 const db=database();
 const {data:x,error:xe}=await db.from('arena_shadow_experiments').select('*').eq('id',experimentId).eq('user_id',owner).eq('status','active').single();
 if(xe||!x)throw Error('Active shadow tournament unavailable.');
 const experiment=x as Experiment;
 const {data:agent,error:ae}=await db.from('arena_agents').select('slug,league').eq('id',x.agent_id).eq('user_id',owner).single();
 if(ae||!agent||agent.league!=='investor')throw Error('Investor agent not found.');
 const [b,c]=await Promise.all([
  db.from('arena_strategy_versions').select('allocation').eq('id',x.baseline_version_id).eq('agent_id',x.agent_id).single(),
  db.from('arena_strategy_versions').select('allocation').eq('id',x.candidate_version_id).eq('agent_id',x.agent_id).single()
 ]);
 if(b.error||c.error||!b.data||!c.data)throw Error('Version parameters unavailable.');
 const baseBook:VariantBook={cash:Number(x.baseline_cash),positions:x.baseline_positions||{}};
 const candidateBook:VariantBook={cash:Number(x.candidate_cash),positions:x.candidate_positions||{}};
 const symbol=selectInvestorCandidate(agent.slug,experiment.cycle_counter);
 if(!symbol)throw Error('Strategy universe unavailable.');
 const required=[...new Set([symbol,...Object.keys(baseBook.positions),...Object.keys(candidateBook.positions)])];
 if(required.length>15)throw Error('Too many shadow symbols for bounded quote evaluation.');
 const prices:Record<string,number>={},observations=new Set<string>();
 for(let i=0;i<required.length;i+=3){
  await Promise.all(required.slice(i,i+3).map(async s=>{
   const q=await getQuote(s);
   if(q.currency!=='USD'||!q.asOf||!Number.isFinite(q.price)||q.price<=0)throw Error('Positive USD quote and observation required for '+s);
   const session=eligiblePaperQuote(new Date(),q.asOf);
   if(!session.eligible)throw Error('Market session or quote validity failed for '+s+': '+session.reason);
   observations.add(q.asOf.slice(0,10));prices[s]=q.price;
  }));
 }
 if(observations.size!==1)throw Error('The shadow portfolios must use precisely aligned market observation dates.');
 const observationDay=[...observations][0];
 const {data:prior}=await db.from('arena_shadow_steps').select('id').eq('experiment_id',experimentId).eq('observation_day',observationDay).maybeSingle();
 if(prior)return {status:'duplicate',observationDay,reason:'This session was already recorded. No paper cash or holdings were modified.'};
 const baseline=simulateShadowBuy(baseBook,symbol,prices[symbol],Number(b.data.allocation));
 const candidate=simulateShadowBuy(candidateBook,symbol,prices[symbol],Number(c.data.allocation));
 const baselineEquity=valueShadowBook(baseline.book,prices),candidateEquity=valueShadowBook(candidate.book,prices);
 if(baselineEquity===null||candidateEquity===null)throw Error('Both books must have complete price coverage to record a paired mark.');
 const {data:stepId,error:stepError}=await db.rpc('arena_record_shadow_step',{
  p_owner:owner,p_experiment:experimentId,p_day:observationDay,p_symbol:symbol,p_reference:prices[symbol],
  p_base_cash:baseline.book.cash,p_candidate_cash:candidate.book.cash,
  p_base_positions:baseline.book.positions,p_candidate_positions:candidate.book.positions,
  p_base_fill:baseline.fill,p_candidate_fill:candidate.fill,
  p_base_equity:baselineEquity,p_candidate_equity:candidateEquity
 });
 if(stepError)throw Error('Atomic shadow book update failed: '+stepError.message);
 return {status:'recorded',stepId,observationDay,symbol,baselineFill:baseline.fill,candidateFill:candidate.fill,
  baselineEquity,candidateEquity,limitations:'Forward paper marks only, same provider date and model assumptions; no claim of improved profits.'};
}
export async function changeStrategy(owner:string,experimentId:string,action:'promote'|'rollback',note:string){
 if(note.trim().length<8||note.length>1000)throw Error('Supply an approval or rollback rationale (8–1000 characters).');
 const db=database();
 const {data:x,error:xe}=await db.from('arena_shadow_experiments').select('id,agent_id,baseline_version_id,candidate_version_id,status').eq('id',experimentId).eq('user_id',owner).single();
 if(xe||!x)throw Error('Experiment not found.');
 const history=await evolutionHistory(owner);
 const experiment=history.experiments.find(v=>v.id===experimentId);
 if(!experiment)throw Error('Comparison data missing.');
 const control=history.controls.find(v=>v.agent_id===x.agent_id);
 if(!control)throw Error('Active strategy control missing.');
 if(action==='promote'){
  if(x.status!=='active'||!experiment.comparison.eligible)throw Error('Promotion requires an active experiment with 20+ valid paired observations, better return and controlled drawdown.');
  if(control.active_version_id!==x.baseline_version_id)throw Error('The baseline was changed since this experiment began.');
 }else{
  if(x.status!=='promoted'||control.active_version_id!==x.candidate_version_id||control.previous_version_id!==x.baseline_version_id)
   throw Error('Rollback is permitted only for the most recently promoted strategy version.');
 }
 const {data,error}=await db.rpc('arena_switch_strategy_version',{
  p_owner:owner,p_experiment:experimentId,p_action:action,p_note:note.trim(),
  p_expected:control.active_version_id,p_next:action==='promote'?x.candidate_version_id:x.baseline_version_id
 });
 if(error)throw Error('Atomic version transition rejected: '+error.message);
 return {changed:true,action,changeId:data,note:'Only future investor-cycle order sizing will change. Existing cash, holdings and order history are untouched.'};
}

/** Retire a losing/inconclusive shadow tournament without touching the live strategy. */
export async function retireShadowExperiment(owner:string,experimentId:string,note:string){
 if(note.trim().length<8||note.trim().length>1000)throw Error('Explain why this shadow experiment is being retired (8–1000 characters).');
 const db=database();
 const {data,error}=await db.from('arena_shadow_experiments')
  .update({status:'retired',finished_at:new Date().toISOString(),retirement_note:note.trim()})
  .eq('id',experimentId).eq('user_id',owner).eq('status','active').select('id').maybeSingle();
 if(error||!data)throw Error('No active shadow tournament was retired. It may already be closed.');
 return {retired:true,id:data.id,note:'The live strategy version, balances and order ledger were not changed.'};
}
