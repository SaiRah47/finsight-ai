'use client';
import {useEffect,useState} from 'react';
import {ARENA_STRATEGIES} from '@/lib/arena-strategies';
import ArenaLearningLab from './ArenaLearningLab';
import ArenaEvolutionLab from './ArenaEvolutionLab';
import AgentOperationsStudio from './AgentOperationsStudio';
import ReplayTournamentPanel from './ReplayTournamentPanel';
import DiversifiedLeague from './DiversifiedLeague';
type Agent={id:string;slug:string;league:'investor'|'trader';status:string;cash:number};
type Position={agent_id:string;symbol:string;shares:number;average_cost:number};
type Order={id:string;agent_id:string;symbol:string;side:string;shares:number;fill_price:number;fee:number;reason:string;signal_date:string;created_at:string};
type Decision={id:string;agent_id:string;cycle_date:string;symbol:string;action:string;reason:string;evidence:string;observed_at:string|null};
type Valuation={agentId:string;equity:number|null;returnPct:number|null;unpricedSymbols:string[];valuedPositions:{symbol:string;shares:number;quote:number;observation:string|null;marketValue:number}[]};
type Snapshot={initialized:boolean;season:{id:string;name:string;mode:string;status:string;created_at:string}|null;agents:Agent[];positions:Position[];orders:Order[];decisions:Decision[];valuations?:Valuation[];quoteFailures?:Record<string,string>;pricingNote?:string;asOf:string};
type CycleResult={cycleDate:string;outcomes:{agent:string;action:'buy'|'hold';symbol:string;reason:string;orderId?:string}[];limitations:string[]};
const currency=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const label=(s:string)=>ARENA_STRATEGIES.find(x=>x.slug===s)?.name||s;
export default function AgentArena(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [cycle,setCycle]=useState<CycleResult|null>(null),[leaderboard,setLeaderboard]=useState(false);
 async function load(withValuation=false){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/arena'+(withValuation?'?value=true':''),{cache:'no-store'});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Agent Arena unavailable');
   setSnapshot(d);setLeaderboard(Boolean(withValuation&&d.valuations));
  }catch(e){setError(e instanceof Error?e.message:'Agent Arena unavailable')}finally{setBusy(false)}
 }
 useEffect(()=>{void load()},[]);
 async function action(op:'initialize'|'cycle'){
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/arena',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:op})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Arena action unavailable');
   if(op==='cycle'){setCycle(data);setNotice('Investor cycle processed. Check individual decisions below; a hold is a valid result.')}else setNotice('Seven virtual accounts initialized. Existing balances were not reset.');
   await load(false);
  }catch(e){setError(e instanceof Error?e.message:'Arena operation failed')}finally{setBusy(false)}
 }
 const investor=snapshot?.agents.filter(x=>x.league==='investor')||[];
 const traders=snapshot?.agents.filter(x=>x.league==='trader')||[];
 const latestOrder=snapshot?.orders||[];
 return <section className="arena-workspace">
  <div className="atlas-phase6-heading"><div><div className="eyebrow">PHASE 8 · PAPER EXPERIMENT / SEASON 1</div><h2>FinSight <span className="gradient">Agent Arena.</span></h2>
    <p>Competing investment philosophies, isolated virtual accounts, auditable decisions, and no real brokerage connection. All numbers are paper-only.</p></div>
   <button className="secondary" disabled={busy} onClick={()=>void load(false)}>Refresh arena ↻</button></div>
  {error&&<p role="alert" className="market-alert">{error}</p>}
  {notice&&<p role="status" className="monitor-success">{notice}</p>}
  <div className="arena-banner"><div><small>VIRTUAL CAPITAL / PER AGENT</small><strong>$5,000</strong><span>Seven independent accounts · $35,000 combined starting virtual capital</span></div>
   <div><small>ACTIVE INVESTOR AGENTS</small><strong>4</strong><span>Strategy baselines · owner-triggered cycles</span></div>
   <div><small>INTRADAY TRADING AGENTS</small><strong>3</strong><span>Paused pending trustworthy intraday fills</span></div></div>
  {!snapshot?.initialized?<div className="atlas-phase6-panel"><h3>Launch Season 1</h3>
   <p className="atlas-hint">Create seven isolated paper accounts without spending money or submitting orders to a brokerage. This is an idempotent setup and will not reset an existing season.</p>
   <button className="primary" disabled={busy||!snapshot} onClick={()=>void action('initialize')}>Initialize virtual accounts ↗</button>
  </div>:<>
  <div className="arena-actions"><div><h3>{snapshot.season?.name} · Forward paper simulation</h3><p>Each investor makes at most one deterministic, risk-sized buy decision per UTC day. No LLM forecasts, intraday fills, or automated rebalancing in the first release.</p></div>
   <button className="primary" disabled={busy} onClick={()=>void action('cycle')}>Run investor cycle ↗</button>
   <button className="secondary" disabled={busy} onClick={()=>void load(true)}>{busy?'Loading…':'Refresh quoted leaderboard ↻'}</button></div>
  {cycle&&<div className="arena-cycle-summary"><strong>Cycle {cycle.cycleDate}</strong><div>{cycle.outcomes.map(item=><p key={item.agent}>{label(item.agent)} · {item.action.toUpperCase()} {item.symbol} — {item.reason}</p>)}</div></div>}
  <div className="sectiontitle"><h2>Investor League</h2><span className="pill">4 strategy baselines</span></div>
  <div className="arena-agent-grid">{investor.map(agent=>{
   const strategy=ARENA_STRATEGIES.find(s=>s.slug===agent.slug);
   const valuation=snapshot.valuations?.find(x=>x.agentId===agent.id);
   const positions=snapshot.positions.filter(p=>p.agent_id===agent.id&&p.shares>0);
   return <article className="arena-agent-card" key={agent.id}>
    <div className="arena-agent-title"><strong>{label(agent.slug)}</strong><span>{agent.status}</span></div>
    <p>{strategy?.thesis}</p>
    <div className="arena-agent-stats"><div><small>Virtual cash</small><strong>{currency(agent.cash)}</strong></div><div><small>Quoted equity</small><strong>{valuation?.equity===undefined?'Not refreshed':valuation.equity===null?'Unavailable':currency(valuation.equity)}</strong></div><div><small>Paper return</small><strong>{valuation?.returnPct===undefined?'—':valuation.returnPct===null?'Unavailable':valuation.returnPct.toFixed(2)+'%'}</strong></div></div>
    <div className="arena-positions"><small>Held positions</small>{positions.length?positions.map(pos=><span key={pos.symbol}>{pos.symbol} · {pos.shares} shares · avg virtual cost {currency(pos.average_cost)}</span>):<span>All cash — no simulated fills yet.</span>}</div>
    {valuation?.unpricedSymbols.length?<p className="atlas-warning">Incomplete quote coverage: {valuation.unpricedSymbols.join(', ')}.</p>:null}
   </article>
  })}</div>
  <div className="sectiontitle"><h2>Trading League</h2><span className="pill">Paused / not evaluated</span></div>
  <div className="arena-trader-grid">{traders.map(agent=><div key={agent.id}><strong>{label(agent.slug)}</strong><span>{ARENA_STRATEGIES.find(s=>s.slug===agent.slug)?.thesis}</span><small>{currency(agent.cash)} virtual cash · {agent.status}</small></div>)}</div>
  <DiversifiedLeague/>
  <ReplayTournamentPanel/>
  <AgentOperationsStudio agents={snapshot.agents}/>
  <ArenaLearningLab agents={snapshot.agents}/>
  <ArenaEvolutionLab agents={snapshot.agents}/>
  <div className="arena-history"><div className="atlas-phase6-panel"><h3>Executed virtual orders · {latestOrder.length} recent</h3>
   {!latestOrder.length?<p className="muted">No virtual orders recorded yet.</p>:latestOrder.slice(0,20).map(order=><div className="arena-history-item" key={order.id}><strong>{label(snapshot.agents.find(a=>a.id===order.agent_id)?.slug||'')}</strong><span>{order.side.toUpperCase()} {order.shares} {order.symbol} @ {currency(Number(order.fill_price))}</span><small>{order.signal_date} · {new Date(order.created_at).toLocaleString()}</small></div>)}</div>
   <div className="atlas-phase6-panel"><h3>Decision audit · {snapshot.decisions.length} recent</h3>
    {!snapshot.decisions.length?<p className="muted">No strategy decisions yet.</p>:snapshot.decisions.slice(0,20).map(decision=><details className="arena-history-item" key={decision.id}><summary>{label(snapshot.agents.find(a=>a.id===decision.agent_id)?.slug||'')} · {decision.action.toUpperCase()} {decision.symbol} · {decision.cycle_date}</summary><p>{decision.reason}</p><small>{decision.evidence}</small></details>)}</div></div>
  </>}
  <p className="atlas-disclaimer">Methodology: forward paper accounts with initial $5,000 each, whole shares and modeled 10bps buy slippage. Virtual orders use provider quotes, not executable exchange prices. No dividends, split adjustments, tax lots, shorting, leverage, or transaction costs beyond modeled slippage. Investor rules are deterministic, not production multi-agent autonomous investment recommendations. Trading League requires validated intraday history and execution assumptions.</p>
 </section>;
}
