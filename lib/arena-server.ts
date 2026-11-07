import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {ARENA_STRATEGIES,calculatePaperBuy,selectInvestorCandidate} from './arena-strategies';
import {getQuote} from './market';
import type {SupabaseClient} from '@supabase/supabase-js';
function admin():SupabaseClient{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Arena requires server-only SUPABASE_SECRET_KEY and Supabase URL.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function initializeArena(owner:string){
 const db=admin();
 const {data:season,error}=await db.from('arena_seasons').upsert({user_id:owner,name:'Season 1',starting_cash:5000,mode:'forward-paper'},{onConflict:'user_id,name'}).select('id').single();
 if(error||!season)throw Error('Cannot initialize Season 1. Apply the Phase 8 migration.');
 const existing=await db.from('arena_agents').select('slug').eq('season_id',season.id);
 if(existing.error)throw Error('Cannot read arena agent records.');
 // Insert only missing agents, NEVER reset existing cash or trade history.
 const seen=new Set((existing.data||[]).map(x=>x.slug));
 const missing=ARENA_STRATEGIES.filter(s=>!seen.has(s.slug)).map(s=>({
  season_id:season.id,user_id:owner,slug:s.slug,league:s.league,status:s.enabled?'active':'paused',cash:5000
 }));
 if(missing.length){
  const {error:ae}=await db.from('arena_agents').insert(missing);
  if(ae&&ae.code!=='23505')throw Error('Could not seed strategy agents: '+ae.message);
 }
 return season.id as string;
}
export async function arenaSnapshot(owner:string){
 const db=admin();
 const {data:season,error:se}=await db.from('arena_seasons').select('id,name,mode,status,starting_cash,created_at').eq('user_id',owner).eq('name','Season 1').maybeSingle();
 if(se)throw Error('Arena not available. Apply the Phase 8 Supabase migration.');
 if(!season)return {initialized:false,season:null,agents:[],positions:[],orders:[],decisions:[],asOf:new Date().toISOString()};
 const [agents,positions,orders,decisions]=await Promise.all([
  db.from('arena_agents').select('id,slug,league,status,cash').eq('user_id',owner).eq('season_id',season.id).order('created_at',{ascending:true}),
  db.from('arena_positions').select('agent_id,symbol,shares,average_cost').eq('user_id',owner),
  db.from('arena_orders').select('id,agent_id,symbol,side,shares,fill_price,fee,reason,signal_date,created_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(70),
  db.from('arena_decisions').select('id,agent_id,cycle_date,symbol,action,reason,evidence,observed_at,created_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(70)
 ]);
 if([agents,positions,orders,decisions].some(x=>x.error))throw Error('Arena records could not be retrieved.');
 return {initialized:true,season,agents:(agents.data||[]).map(a=>({...a,cash:Number(a.cash)})),
  positions:(positions.data||[]).map(p=>({...p,shares:Number(p.shares),average_cost:Number(p.average_cost)})),
  orders:orders.data||[],decisions:decisions.data||[],asOf:new Date().toISOString()};
}
type DecisionOutcome={agent:string;action:'buy'|'hold';symbol:string;reason:string;orderId?:string};
export async function runInvestorCycle(owner:string):Promise<{cycleDate:string;outcomes:DecisionOutcome[];limitations:string[]}>{
 const db=admin();
 const {data:season,error:sError}=await db.from('arena_seasons').select('id,status').eq('user_id',owner).eq('name','Season 1').maybeSingle();
 if(sError||!season||season.status!=='active')throw Error('Initialize an active arena season first.');
 // Market observation date may differ from UTC cycle date. Limit to one decision per agent/UTC day.
 const cycleDate=new Date().toISOString().slice(0,10);
 const {data:agents,error:aError}=await db.from('arena_agents').select('id,slug,league,cash,status').eq('user_id',owner).eq('season_id',season.id);
 if(aError)throw Error('Could not read arena agents.');
 const outcomes:DecisionOutcome[]=[];
 for(const agent of (agents||[]).filter(a=>a.league==='investor'&&a.status==='active')){
  const {count,error:historyError}=await db.from('arena_decisions').select('id',{count:'exact',head:true}).eq('agent_id',agent.id);
  if(historyError){outcomes.push({agent:agent.slug,action:'hold',symbol:'-',reason:'Decision history unavailable; skipped.'});continue}
  const symbol=selectInvestorCandidate(agent.slug,count||0);
  if(!symbol)continue;
  const {data:existing}=await db.from('arena_decisions').select('id,action').eq('agent_id',agent.id).eq('cycle_date',cycleDate).maybeSingle();
  if(existing){outcomes.push({agent:agent.slug,action:'hold',symbol,reason:'Daily decision already recorded; no duplicate order.'});continue}
  let action:'buy'|'hold'='hold',reason='',evidence='',orderId:string|undefined,observation:string|null=null;
  try{
   const quote=await getQuote(symbol);
   observation=quote.asOf;
   if(quote.currency!=='USD'||quote.price<=0||!observation)throw Error('USD quote or observation date unavailable.');
   // Investor agents deliberately do not use intraday data, unvalidated forecasts or leverage.
   const sizing=calculatePaperBuy(Number(agent.cash),quote.price,0.20,10,0);
   if(!sizing)throw Error('Insufficient virtual cash for one whole-share position under sizing limits.');
   reason='Strategy universe rotation; buys up to 20% of initial virtual capital at a quote plus 10bps modeled slippage. No valuation/momentum forecast is claimed.';
   evidence='Twelve Data '+symbol+' quote '+quote.price+' USD, provider observation '+quote.asOf+', fetched '+quote.fetchedAt;
   const {data:order,error:tradeError}=await db.rpc('arena_execute_virtual_order',{
    p_agent:agent.id,p_owner:owner,p_request_key:'season1:'+cycleDate+':'+agent.slug+':'+symbol,
    p_symbol:symbol,p_side:'buy',p_shares:sizing.shares,p_reference_price:quote.price,
    p_fill_price:sizing.fill,p_fee:sizing.fee,p_signal_date:observation,p_reason:reason
   });
   if(tradeError)throw Error('Paper order rejected: '+tradeError.message);
   orderId=String(order);action='buy';
  }catch(error){
   reason=error instanceof Error?error.message:'No eligible market observation';
   evidence='No paper trade executed. No synthetic fill or quote created.';
  }
  // Unique(agent,cycle_date) records the decision once, even if no trade is executed.
  const {error:decisionError}=await db.from('arena_decisions').insert({
   user_id:owner,season_id:season.id,agent_id:agent.id,cycle_date:cycleDate,symbol,action,
   reason,evidence,observed_at:observation,order_id:orderId??null
  });
  if(decisionError&&decisionError.code!=='23505')reason+=' Decision audit persistence failed: '+decisionError.message;
  outcomes.push({agent:agent.slug,action,symbol,reason,orderId});
 }
 return {cycleDate,outcomes,limitations:[
  'Investor decisions are deterministic strategy baselines, not autonomous LLM-directed trades.',
  'Whole-share positions, 10 basis point modeled buy slippage, no commissions, no leverage.',
  'Execution is virtual at a provider-reported reference price, not a real executable NBBO quote.',
  'Daily cycle is owner-triggered, not continuously scheduled. Trader league remains paused.',
  'No performance attribution or comparison can be inferred before obtaining dated post-trade valuations.'
 ]};
}
