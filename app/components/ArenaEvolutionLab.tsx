'use client';
import {useEffect,useState} from 'react';
import {ARENA_STRATEGIES} from '@/lib/arena-strategies';
type Agent={id:string;slug:string;league:'investor'|'trader'};
type Version={id:string;agent_id:string;version:number;allocation:number;kind:string};
type Control={agent_id:string;active_version_id:string;previous_version_id:string|null};
type Gate={eligible:boolean;pairedSessions:number;baselineReturnPct:number|null;candidateReturnPct:number|null;returnDeltaPct:number|null;baselineDrawdownPct:number|null;candidateDrawdownPct:number|null;reasons:string[]};
type Experiment={id:string;agent_id:string;baseline_version_id:string;candidate_version_id:string;status:'active'|'promoted'|'retired';cycle_counter:number;baseline_cash:number;candidate_cash:number;
 comparison:Gate;steps:{day:string;baselineEquity:number;candidateEquity:number}[];started_at:string};
type Change={id:string;agent_id:string;action:string;from_version_id:string;to_version_id:string;note:string;created_at:string};
type Payload={versions:Version[];controls:Control[];experiments:Experiment[];changes:Change[];methodology:string};
const name=(slug:string)=>ARENA_STRATEGIES.find(s=>s.slug===slug)?.name||slug;
const cash=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export default function ArenaEvolutionLab({agents}:{agents:Agent[]}){
 const [data,setData]=useState<Payload|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [allocations,setAllocations]=useState<Record<string,string>>({}),[notes,setNotes]=useState<Record<string,string>>({});
 async function load(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/arena/evolution',{cache:'no-store'}),body=await r.json();
   if(!r.ok)throw Error(body.error||'Shadow tournaments unavailable');
   setData(body);
  }catch(e){setError(e instanceof Error?e.message:'Shadow tournaments unavailable')}
  finally{setBusy(false)}
 }
 useEffect(()=>{void load()},[]);
 async function submit(payload:Record<string,unknown>,success:string){
  setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/arena/evolution',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),result=await r.json();
   if(!r.ok)throw Error(result.error||'The operation was not accepted');
   setMessage(success+(result.status==='duplicate'?' The session was already recorded.':''));
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Shadow operation failed')}
  finally{setBusy(false)}
 }
 const versions=data?.versions||[];
 const version=(id:string)=>versions.find(v=>v.id===id);
 const investors=agents.filter(a=>a.league==='investor');
 return <section className="arena-evolution">
  <div className="sectiontitle"><h2>Strategy Evolution Arena</h2><span className="pill">Versioned · Shadow-tested · Owner-approved</span></div>
  <p className="atlas-hint">Each tournament creates two independent $5,000 paper accounts on the same start date. The current allocation and a challenger compete using the same source-dated stock observations. No experiment can change Season 1 positions or orders without explicit promotion.</p>
  <div className="arena-evolution-guide"><div><strong>01</strong><span>Create challenger</span></div><div><strong>02</strong><span>Run paired paper sessions</span></div><div><strong>03</strong><span>Review return and drawdown</span></div><div><strong>04</strong><span>Approve or retain baseline</span></div></div>
  {error&&<div className="market-alert" role="alert">{error}</div>}
  {message&&<p role="status" className="monitor-success">{message}</p>}
  <div className="arena-evolution-grid">{investors.map(agent=>{
   const ctrl=data?.controls.find(x=>x.agent_id===agent.id);
   const active=ctrl?version(ctrl.active_version_id):undefined;
   const experiments=data?.experiments.filter(x=>x.agent_id===agent.id)||[];
   const open=experiments.find(x=>x.status==='active');
   const latest=experiments[0];
   const proposed=allocations[agent.id]??'10';
   const currentAllocation=active?.allocation??0.2;
   return <article key={agent.id} className="arena-evolution-card">
    <div className="arena-agent-title"><strong>{name(agent.slug)}</strong><span>{active?'Strategy v'+active.version:'Baseline v1'}</span></div>
    <p className="atlas-hint">Live paper allocation cap: {(currentAllocation*100).toFixed(0)}% of original $5,000 per buy; virtual positions are not reset on version changes.</p>
    {!open&&<div className="arena-evolution-create">
      <label>Shadow candidate order-size cap (%)
       <select disabled={busy} value={proposed} onChange={e=>setAllocations(p=>({...p,[agent.id]:e.target.value}))}>
        {Array.from({length:21},(_,i)=>i+5).map(n=><option key={n} value={n}>{n}%</option>)}
       </select>
      </label>
      <button className="secondary" disabled={busy||!data||Number(proposed)/100===currentAllocation} onClick={()=>void submit({action:'create',agentId:agent.id,allocation:Number(proposed)/100},'Independent baseline and challenger accounts created.')}>Create shadow experiment ↗</button>
     </div>}
    {latest&&<div className="arena-evolution-current">
      <div className="arena-evolution-header"><strong>v{version(latest.baseline_version_id)?.version??'?'} vs. v{version(latest.candidate_version_id)?.version??'?'}</strong><span>{latest.status}</span></div>
      <div className="arena-evolution-kpis"><div><small>Paired sessions</small><strong>{latest.comparison.pairedSessions}/20</strong></div>
       <div><small>Baseline paper return</small><strong>{latest.comparison.baselineReturnPct===null?'—':latest.comparison.baselineReturnPct.toFixed(2)+'%'}</strong></div>
       <div><small>Challenger paper return</small><strong>{latest.comparison.candidateReturnPct===null?'—':latest.comparison.candidateReturnPct.toFixed(2)+'%'}</strong></div>
       <div><small>Return difference</small><strong>{latest.comparison.returnDeltaPct===null?'—':latest.comparison.returnDeltaPct.toFixed(2)+' pts'}</strong></div></div>
      <p className="atlas-hint">Baseline drawdown: {latest.comparison.baselineDrawdownPct??'—'}% · Challenger drawdown: {latest.comparison.candidateDrawdownPct??'—'}%. This is a forward paper experiment, not historical backtesting.</p>
      {latest.comparison.reasons.map((reason,i)=><p className="arena-evolution-reason" key={i}>{reason}</p>)}
      {open&&<button className="primary" disabled={busy} onClick={()=>void submit({action:'step',experimentId:latest.id},'One paired shadow session processed.')}>Run shadow session ↗</button>}
      {latest.steps.length>0&&<details className="arena-evolution-history"><summary>Session equity observations ({latest.steps.length} recent)</summary>
       {latest.steps.slice(-12).reverse().map(step=><div key={step.day}><span>{step.day}</span><span>{cash(step.baselineEquity)}</span><span>{cash(step.candidateEquity)}</span></div>)}
      </details>}
      {latest.status==='active'&&!latest.comparison.eligible&&<details className="arena-evolution-retire"><summary>End this experiment without promotion</summary>
       <p className="atlas-hint">Retiring this candidate retains all comparison history and unlocks a new experiment. The live paper strategy remains unchanged.</p>
       <label>Retirement rationale<textarea rows={2} maxLength={1000} value={notes[latest.id]||''} onChange={e=>setNotes(p=>({...p,[latest.id]:e.target.value}))} placeholder="Explain why you want to stop testing this candidate..."/></label>
       <button className="secondary" disabled={busy||(notes[latest.id]||'').trim().length<8} onClick={()=>void submit({action:'retire',experimentId:latest.id,note:notes[latest.id],confirmation:'RETIRE SHADOW EXPERIMENT'},'Experiment retired; the live paper strategy remains unchanged.')}>Retire shadow experiment</button>
      </details>}
      {(latest.status==='active'&&latest.comparison.eligible||latest.status==='promoted')&&<div className="arena-evolution-approval">
       <label>Decision rationale (required)
        <textarea rows={2} maxLength={1000} placeholder="Describe evidence, limitations, and why you approve this change..." value={notes[latest.id]||''} onChange={e=>setNotes(p=>({...p,[latest.id]:e.target.value}))}/>
       </label>
       {latest.status==='active'?<><button className="primary" disabled={busy||(notes[latest.id]||'').trim().length<8} onClick={()=>void submit({action:'promote',experimentId:latest.id,note:notes[latest.id],confirmation:'PROMOTE PAPER STRATEGY'},'Version promoted for future Season 1 paper buys only.')}>Approve paper promotion</button>
       <button className="secondary" disabled={busy||(notes[latest.id]||'').trim().length<8} onClick={()=>void submit({action:'retire',experimentId:latest.id,note:notes[latest.id],confirmation:'RETIRE SHADOW EXPERIMENT'},'Candidate retired without changing the live strategy.')}>Retain baseline / retire candidate</button></>:
       <button className="secondary" disabled={busy||(notes[latest.id]||'').trim().length<8||ctrl?.active_version_id!==latest.candidate_version_id} onClick={()=>void submit({action:'rollback',experimentId:latest.id,note:notes[latest.id],confirmation:'ROLL BACK PAPER STRATEGY'},'Previous paper sizing version restored for future decisions.')}>Rollback to baseline</button>}
      </div>}
     </div>}
    {!latest&&<p className="muted">No shadow experiment started yet. Create a challenger to begin collecting evidence.</p>}
   </article>
  })}</div>
  {!!data?.changes.length&&<details className="arena-evolution-log"><summary>Version changes and rollback audit ({data.changes.length})</summary>
   {data.changes.map(x=><p key={x.id}>{new Date(x.created_at).toLocaleString()} · {name(agents.find(a=>a.id===x.agent_id)?.slug||'')} · {x.action}: v{version(x.from_version_id)?.version} → v{version(x.to_version_id)?.version} · {x.note}</p>)}
  </details>}
  <p className="atlas-disclaimer">Promotion gate: at least 20 paired dated observations, positive return improvement and no drawdown deterioration beyond one percentage point. These are mechanical guardrails, not statistical proof of alpha. Shadow books are independent; promotion changes only future order sizing, never backfills trades or guarantees profit. Intraday trader agents remain paused.</p>
 </section>;
}
