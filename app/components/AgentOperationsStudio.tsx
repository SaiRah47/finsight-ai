'use client';
import {useEffect,useMemo,useState} from 'react';
import {ARENA_STRATEGIES} from '@/lib/arena-strategies';
import {STUDIO_STAGES,type StudioEvidence,type StudioStage,type StudioTrace,type RoleOutput} from '@/lib/arena-operations';

type Agent={id:string;slug:string;league:'investor'|'trader';status:string};
type StageEvent={kind:'stage-start'|'stage-complete'|'result';stage?:StudioStage;role?:RoleOutput;trace?:StudioTrace;at:string};
const personas:Record<string,{avatar:string;accent:string;subtitle:string}>={
 'ai-maximalist':{avatar:'AI',accent:'violet',subtitle:'AI-first investment thesis'},
 'ai-skeptic':{avatar:'SK',accent:'amber',subtitle:'Traditional-sector counterweight'},
 'mag7-purist':{avatar:'M7',accent:'cyan',subtitle:'Seven-stock technology universe'},
 'value-investor':{avatar:'VA',accent:'rose',subtitle:'Fundamental-value discipline'}
};
const roles:Record<StudioStage,{glyph:string;number:string;caption:string}>={
 research:{glyph:'◎',number:'01',caption:'Collects evidence'},
 strategy:{glyph:'✦',number:'02',caption:'Forms a thesis'},
 critic:{glyph:'⚡',number:'03',caption:'Challenges the thesis'},
 risk:{glyph:'⛨',number:'04',caption:'Checks hard limits'},
 decision:{glyph:'◇',number:'05',caption:'Resolves debate'}
};
function pill(vote:string){return vote==='support'?'Supports thesis':vote==='challenge'?'Challenges thesis':vote==='veto'?'Vetoes action':vote==='observe'?'Observes evidence':vote}
export default function AgentOperationsStudio({agents}:{agents:Agent[]}){
 const investors=agents.filter(a=>a.league==='investor');
 const [selected,setSelected]=useState(''),[runs,setRuns]=useState<StudioTrace[]>([]),[trace,setTrace]=useState<StudioTrace|null>(null);
 const [running,setRunning]=useState(false),[current,setCurrent]=useState<StudioStage|null>(null);
 const [completed,setCompleted]=useState<RoleOutput[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [pane,setPane]=useState<'debate'|'evidence'|'audit'>('debate'),[expanded,setExpanded]=useState<StudioStage|null>(null);
 const active=investors.find(a=>a.id===selected)||investors[0];
 const activeId=active?.id||'';
 const persona=personas[active?.slug||'']||{avatar:'AT',accent:'violet',subtitle:'Investment research'};
 useEffect(()=>{if(!selected&&investors.length)setSelected(investors[0].id)},[investors,selected]);
 useEffect(()=>{
  if(!activeId)return;
  let cancelled=false;
  setTrace(null);setCompleted([]);setCurrent(null);setNotice('');setError('');
  fetch('/api/arena/studio?agentId='+encodeURIComponent(activeId),{cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Research runs unavailable');return d as {runs:StudioTrace[]}})
   .then(d=>{if(!cancelled){setRuns(d.runs);setTrace(d.runs[0]||null)}})
   .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Could not load research runs')});
  return ()=>{cancelled=true};
 },[activeId]);
 const visibleRoles=running?completed:trace?.steps||[];
 const stageState=(id:StudioStage)=>current===id?'running':visibleRoles.some(r=>r.stage===id)?'done':'waiting';
 const evidence=trace?.evidence||[];
 const debate=trace?.debate||[];
 const coverage=trace?.guardrails.providerCoverage??0;
 const duration=trace?.elapsedMs??null;
 const mode=trace?.researchMode==='ai-assisted'?'AI + deterministic safeguards':'Deterministic fallback';
 async function launch(){
  if(!activeId||running)return;
  setRunning(true);setTrace(null);setCompleted([]);setCurrent(null);setError('');setNotice('');setPane('debate');setExpanded(null);
  try{
   const r=await fetch('/api/arena/studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:activeId})});
   if(!r.ok||!r.body){const d=await r.json().catch(()=>({}));throw Error(d.error||'Could not start the research room')}
   const reader=r.body.getReader(),decoder=new TextDecoder();
   let buffer='',received=false,stageError='';
   while(true){
    const {done,value}=await reader.read();if(done)break;
    buffer+=decoder.decode(value,{stream:true});
    let stop:number;
    while((stop=buffer.indexOf('\n\n'))>=0){
     const record=buffer.slice(0,stop);buffer=buffer.slice(stop+2);
     const eventType=record.match(/^event:\s*(.*)$/m)?.[1],payload=record.match(/^data:\s*(.*)$/m)?.[1];
     if(!payload)continue;
     const e=JSON.parse(payload) as StageEvent&{message?:string};
     if(eventType==='error'){stageError=e.message||'The research workflow failed';continue}
     if(e.kind==='stage-start'&&e.stage){setCurrent(e.stage);setExpanded(e.stage)}
     if(e.kind==='stage-complete'&&e.role){setCompleted(old=>[...old.filter(x=>x.stage!==e.role!.stage),e.role!]);}
     if(e.kind==='result'&&e.trace){setTrace(e.trace);setCurrent(null);received=true;setNotice('Evidence, debate and risk checks saved as a private research audit. No trades were placed.');}
    }
   }
   if(stageError)throw Error(stageError);
   if(!received)throw Error('The workflow ended without a persisted result.');
   const history=await fetch('/api/arena/studio?agentId='+encodeURIComponent(activeId),{cache:'no-store'});
   if(history.ok){const d=await history.json() as {runs:StudioTrace[]};setRuns(d.runs)}
  }catch(e){setError(e instanceof Error?e.message:'Research session failed')}
  finally{setRunning(false);setCurrent(null)}
 }
 const showing=useMemo(()=>visibleRoles.filter(r=>r.stage!=='research'),[visibleRoles]);
 return <section className="atlas-ops">
  <div className="atlas-ops-top">
   <div className="atlas-ops-title"><span className="atlas-ops-eyebrow"><span className="atlas-ops-live-dot"/> FINSIGHT / MULTI-AGENT CONTROL ROOM</span>
    <h2>Every decision has <em>a story.</em></h2>
    <p>Watch independent research roles gather facts, debate an investment thesis and enforce risk rules. All stages are inspectable, and nothing is sent to a broker or paper ledger.</p>
   </div>
   <div className="atlas-ops-top-counter"><span>Sub-agent architecture</span><strong>05</strong><small>observable workflow stages</small></div>
  </div>
  <div className="atlas-ops-shell">
   <aside className="atlas-ops-side">
    <div className="atlas-ops-side-title"><span>THE STRATEGY TEAMS</span><small>{investors.length} live investor teams</small></div>
    <div className="atlas-ops-teams">{investors.map(agent=>{
     const p=personas[agent.slug]||persona;
     return <button type="button" className={'atlas-ops-team '+(activeId===agent.id?'chosen':'')} key={agent.id} onClick={()=>{if(!running){setSelected(agent.id);setExpanded(null)}}} disabled={running}>
      <span className={'atlas-ops-avatar '+p.accent}>{p.avatar}</span>
      <span className="atlas-ops-team-copy"><strong>{ARENA_STRATEGIES.find(s=>s.slug===agent.slug)?.name||agent.slug}</strong><small>{p.subtitle}</small></span>
      <span className="atlas-ops-team-chevron">›</span>
     </button>
    })}</div>
    <div className="atlas-ops-sidebar-footer"><span className="atlas-ops-pulse">◉</span><div><strong>Observer mode</strong><small>Agent discussion is research-only. Zero automatic orders.</small></div></div>
    {runs.length>0&&<div className="atlas-ops-archive"><span>PAST SESSIONS</span>{runs.slice(0,6).map(run=><button key={run.id} disabled={running} onClick={()=>{setTrace(run);setCompleted([]);setPane('debate');setExpanded(null);setNotice('Viewing a saved research session.')}}><strong>{run.symbol} · {run.verdict.toUpperCase()}</strong><small>{new Date(run.createdAt).toLocaleString()}</small></button>)}</div>}
   </aside>
   <div className="atlas-ops-main">
    <div className="atlas-ops-command">
     <div className="atlas-ops-selected"><span className={'atlas-ops-avatar large '+persona.accent}>{persona.avatar}</span><div><small>TEAM IN FOCUS</small><h3>{ARENA_STRATEGIES.find(s=>s.slug===active?.slug)?.name||'Choose an investor'}</h3><span>{persona.subtitle}</span></div></div>
     <button type="button" className="atlas-ops-start" disabled={running||!activeId} onClick={()=>void launch()}>{running?'◌  Research in progress':'▶  Run full research debate'}</button>
    </div>
    <div className="atlas-ops-flow">
     <div className="atlas-ops-flow-heading"><div><span>WORKFLOW BLUEPRINT</span><strong>{running?'Executing actual server stages':trace?'Recorded research workflow':'Ready to explore'}</strong></div><div className="atlas-ops-signal">{running?'● Processing':trace?'● Saved to audit':'○ Awaiting run'}</div></div>
     <div className="atlas-ops-nodes">{STUDIO_STAGES.map((node,i)=>{
      const state=stageState(node.id);
      const role=visibleRoles.find(r=>r.stage===node.id);
      return <div className="atlas-ops-node-wrap" key={node.id}>
       <button type="button" disabled={!role} className={'atlas-ops-node '+state+(expanded===node.id?' selected':'')} onClick={()=>{setExpanded(expanded===node.id?null:node.id);setPane('debate')}} aria-label={node.name+' '+state}>
        <span className="atlas-ops-node-num">{roles[node.id].number}</span>
        <span className="atlas-ops-node-icon">{roles[node.id].glyph}</span>
        <strong>{node.name}</strong><small>{roles[node.id].caption}</small>
        <span className="atlas-ops-node-state">{state==='running'?'◌ Live':state==='done'?role?.status==='blocked'?'⊘ Blocked':'✓ Complete':'Not started'}</span>
       </button>
       {i<STUDIO_STAGES.length-1&&<span className="atlas-ops-connector" aria-hidden="true">→</span>}
      </div>
     })}</div>
     {expanded&&visibleRoles.find(r=>r.stage===expanded)&&<div className="atlas-ops-inspector">
      <div><span>INSPECTING {expanded.toUpperCase()}</span><button onClick={()=>setExpanded(null)} aria-label="Close role details">×</button></div>
      <strong>{visibleRoles.find(r=>r.stage===expanded)?.headline}</strong><p>{visibleRoles.find(r=>r.stage===expanded)?.explanation}</p>
      <small>Mode: {visibleRoles.find(r=>r.stage===expanded)?.mode==='ai'?'LLM-assisted':'Deterministic rules'} · {visibleRoles.find(r=>r.stage===expanded)?.durationMs}ms · {visibleRoles.find(r=>r.stage===expanded)?.citedIds.join(', ')||'No cited observations'}</small>
     </div>}
    </div>
    <div className="atlas-ops-status-row">
     <div><small>SOURCE COVERAGE</small><strong>{trace?coverage+'/4':'—'}</strong><span>available observations</span></div>
     <div><small>REASONING MODE</small><strong>{trace?mode:running?'Running':'—'}</strong><span>visible per-role attribution</span></div>
     <div><small>LAST SESSION</small><strong>{duration!==null?(duration/1000).toFixed(1)+'s':'—'}</strong><span>recorded execution time</span></div>
     <div><small>EXECUTION POLICY</small><strong className="atlas-ops-safe">Research only</strong><span>paper orders disabled here</span></div>
    </div>
    {error&&<div role="alert" className="atlas-ops-error">{error}</div>}
    {notice&&<div role="status" className="atlas-ops-notice">{notice}</div>}
    <div className="atlas-ops-tabs" role="tablist" aria-label="Research room sections">
     {(['debate','evidence','audit'] as const).map(tab=><button type="button" role="tab" aria-selected={pane===tab} className={pane===tab?'active':''} key={tab} onClick={()=>setPane(tab)}>{tab==='debate'?'⚡ Live Debate':tab==='evidence'?'◎ Evidence Library':'▤ Decision Audit'}</button>)}
    </div>
    {pane==='debate'&&<div className="atlas-ops-debate">
     <div className="atlas-ops-panel-heading"><div><span>THE DEBATE CHAMBER</span><h3>Ideas get challenged here.</h3></div><span>{showing.length} / 4 contributions</span></div>
     {!showing.length&&<div className="atlas-ops-empty"><div className="atlas-ops-empty-icon">✧</div><strong>The room is ready.</strong><p>Run a research debate to reveal what each agent concludes, what the critic disagrees with, and why the Risk Guardian may veto action.</p></div>}
     <div className="atlas-ops-debate-list">{showing.map((role,i)=><article key={role.stage} className={'atlas-ops-message '+role.stage}>
      <div className={'atlas-ops-message-avatar '+role.stage}>{roles[role.stage].glyph}</div>
      <div className="atlas-ops-message-body"><div className="atlas-ops-message-head"><strong>{role.role}</strong><span className={'atlas-ops-vote '+role.vote}>{pill(role.vote)}</span><small>{role.mode==='ai'?'AI reasoning':'Rules fallback'} · {role.durationMs}ms</small></div>
       <h4>{role.headline}</h4><p>{role.explanation}</p>
       <div className="atlas-ops-message-tags">{role.citedIds.map(id=><span key={id}>{id} · Source evidence</span>)}{role.checks.slice(0,2).map(ch=><span key={ch}>✓ {ch}</span>)}</div>
      </div>
      <span className="atlas-ops-message-index">0{i+1}</span>
     </article>)}</div>
     {running&&<div className="atlas-ops-thinking"><span/><span/><span/> <small>Next agent is evaluating the previous arguments…</small></div>}
    </div>}
    {pane==='evidence'&&<div className="atlas-ops-evidence">
     <div className="atlas-ops-panel-heading"><div><span>SOURCE TRANSPARENCY</span><h3>The evidence wall.</h3></div><span>{evidence.filter(e=>e.available).length} verified observations</span></div>
     {!evidence.length&&<div className="atlas-ops-empty">Evidence cards will appear after an actual research session. No sample metrics are fabricated.</div>}
     <div className="atlas-ops-evidence-grid">{evidence.map(e=><article key={e.id} className={'atlas-ops-evidence-card '+(e.available?'available':'missing')}>
      <div className="atlas-ops-evidence-label"><span>{e.id}</span><small>{e.available?'● Retrieved':'○ Unavailable'}</small></div>
      <h4>{e.label}</h4><strong>{e.value}</strong><p>{e.source} · observation {e.asOf||'not provided'}</p>
      {e.url&&e.available&&<a href={e.url} target="_blank" rel="noreferrer">Open original source ↗</a>}
     </article>)}</div>
    </div>}
    {pane==='audit'&&<div className="atlas-ops-audit">
     <div className="atlas-ops-panel-heading"><div><span>DECISION TRANSPARENCY</span><h3>No black-box executions.</h3></div></div>
     {!trace&&<div className="atlas-ops-empty">The risk gate and permanent audit become available after a completed research session.</div>}
     {trace&&<><div className={'atlas-ops-verdict '+trace.verdict}><span>COUNCIL OUTCOME</span><strong>{trace.verdict==='consider'?'Consider further review':trace.verdict==='hold'?'Hold / investigate':'Abstain — blocked'}</strong><p>{trace.guardrails.reason}</p></div>
      <div className="atlas-ops-audit-grid"><div><small>Order permission</small><strong>Not permitted</strong></div><div><small>Risk veto</small><strong>{trace.guardrails.riskVeto?'Yes':'No'}</strong></div><div><small>Data providers</small><strong>{trace.guardrails.providerCoverage} / 4</strong></div><div><small>Audit reference</small><strong>{trace.id?.slice(0,8)||'—'}</strong></div></div>
      <div className="atlas-ops-audit-note"><strong>Evidence limitations</strong>{trace.limitations.map((x,i)=><p key={i}>• {x}</p>)}</div>
     </>}
    </div>}
    <div className="atlas-ops-bottom">This workspace displays actual backend stage transitions, not a fabricated animation. Generated opinions are research-only and can be wrong. No trades, strategy updates, or performance results are created by a debate.</div>
   </div>
  </div>
 </section>;
}