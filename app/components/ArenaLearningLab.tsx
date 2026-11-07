'use client';
import {useEffect,useState} from 'react';
import {ARENA_STRATEGIES} from '@/lib/arena-strategies';
type Diagnostic={
 sampleDays:number;firstDay:string|null;lastDay:string|null;netReturnPct:number|null;
 maxDrawdownPct:number|null;dailyVolatilityPct:number|null;observedNegativeDays:number;
 verdict:'insufficient-data'|'needs-investigation'|'observation-only';findings:string[];
 candidateChange:{parameter:'targetAllocation'|'none';current:number|null;candidate:number|null;reason:string;stage:'research-only'};
};
type Review={agent_id:string;review_day:string;verdict:string;diagnostics:Diagnostic;proposed_change:Diagnostic['candidateChange'];status:string;created_at:string};
type History={observations:{agent_id:string;observation_day:string;equity:number}[];reviews:Review[];note:string};
type ObserveResult={outcomes:{agent:string;status:string;observationDay:string|null;reason:string}[];limitations:string[]};
const names=(slug:string)=>ARENA_STRATEGIES.find(x=>x.slug===slug)?.name||slug;
export default function ArenaLearningLab({agents}:{agents:{id:string;slug:string;league:'investor'|'trader'}[]}){
 const [data,setData]=useState<History|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [captured,setCaptured]=useState<ObserveResult|null>(null);
 async function load(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/arena/learning',{cache:'no-store'}),json=await response.json();
   if(!response.ok)throw Error(json.error||'Learning history unavailable');
   setData(json);
  }catch(e){setError(e instanceof Error?e.message:'Learning history unavailable')}
  finally{setBusy(false)}
 }
 useEffect(()=>{void load()},[]);
 async function run(action:'observe'|'review'){
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/arena/learning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}),result=await response.json();
   if(!response.ok)throw Error(result.error||'Learning operation unavailable');
   if(action==='observe'){
    setCaptured(result);
    setMessage('Observation check completed. Only fully priced, aligned session data was stored.');
   }else{
    setMessage('Research-only diagnostic reviews saved; no agent strategy or positions were changed.');
   }
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Learning operation unavailable')}
  finally{setBusy(false)}
 }
 const reviewers=agents.filter(x=>x.league==='investor');
 return <section className="arena-learning">
  <div className="sectiontitle"><h2>Agent learning lab</h2><span className="pill">Research only · no auto-optimization</span></div>
  <p className="atlas-hint">Agents can learn from evidence by comparing their own historical paper-equity observations and proposing controlled experiments. A losing streak alone is not proof that a strategy is wrong, and winning trades are not proof it is good.</p>
  <div className="arena-learning-actions">
   <button className="primary" disabled={busy} onClick={()=>void run('observe')}>{busy?'Processing…':'Record session equity ↗'}</button>
   <button className="secondary" disabled={busy} onClick={()=>void run('review')}>Review agent performance ↗</button>
   <button className="pill" disabled={busy} onClick={()=>void load()}>Refresh reviews ↻</button>
  </div>
  {error&&<div className="market-alert" role="alert">{error}</div>}
  {message&&<p className="monitor-success" role="status">{message}</p>}
  {captured&&<details className="arena-learning-coverage" open><summary>Last observation capture details</summary>
   {captured.outcomes.map(x=><p key={x.agent}>{names(x.agent)} · {x.status} · {x.observationDay||'No session'} — {x.reason}</p>)}
  </details>}
  <div className="arena-learning-grid">{reviewers.map(agent=>{
   const history=data?.observations.filter(x=>x.agent_id===agent.id)||[];
   const review=data?.reviews.find(x=>x.agent_id===agent.id);
   const diagnostics=review?.diagnostics;
   const suggested=diagnostics?.candidateChange;
   return <article key={agent.id} className="arena-learning-card">
    <div className="arena-agent-title"><strong>{names(agent.slug)}</strong><span>{review?.verdict||'No review yet'}</span></div>
    <div className="arena-learning-stats"><div><small>Observed sessions</small><strong>{history.length}</strong></div><div><small>Reviewed drawdown</small><strong>{diagnostics?.maxDrawdownPct===null||diagnostics?.maxDrawdownPct===undefined?'—':diagnostics.maxDrawdownPct.toFixed(2)+'%'}</strong></div><div><small>Paper return</small><strong>{diagnostics?.netReturnPct===null||diagnostics?.netReturnPct===undefined?'—':diagnostics.netReturnPct.toFixed(2)+'%'}</strong></div></div>
    {review?<><div className="arena-learning-findings">{diagnostics?.findings.map((finding,i)=><p key={i}>{finding}</p>)}</div>
     <div className="arena-learning-proposal"><small>Potential strategy experiment</small>
      <p>{suggested?.reason||'No change proposed.'}</p>
      {suggested?.parameter==='targetAllocation'&&<strong>Current cap {(suggested.current!*100).toFixed(0)}% → Shadow candidate {(suggested.candidate!*100).toFixed(0)}%</strong>}
      <span>Review from {review.review_day} · research-only / never automatically applied</span></div>
    </>:<p className="muted">No review has been generated. The first five valid session observations only support preliminary diagnostics; 20 are required before a parameter hypothesis is suggested.</p>}
   </article>
  })}</div>
  <p className="atlas-disclaimer">Only verified source-dated, complete virtual equity observations are stored. Reviews are descriptive. Candidate allocation changes are not deployed, backtested, or evidence of profitability; promotion requires future out-of-sample shadow testing, risk and cost checks, and explicit approval.</p>
 </section>;
}
