'use client';
import {useEffect,useState} from 'react';
import {REPLAY_PROXIES,type ReplayTournament} from '@/lib/arena-replay';
type Archive={id:string;symbol:string;observation_count:number;last_date:string;dataset_sha256:string}|null;
type Coverage={slug:string;symbol:string;name:string;rule:string;archive:Archive};
type Saved={id:string;created_at:string;run_key:string;result:ReplayTournament};
type Data={coverage:Coverage[];runs:Saved[]};
const usd=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
function Spark({values}:{values:number[]}){
 const w=320,h=74,min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min);
 const points=values.map((v,i)=>`${(i/Math.max(1,values.length-1)*w).toFixed(1)},${(h-5-(v-min)/range*(h-10)).toFixed(1)}`).join(' ');
 return <svg viewBox="0 0 320 74" role="img" aria-label="Simulated equity over matched historical sessions" style={{width:'100%',height:80,overflow:'visible'}}>
  <line x1="0" x2="320" y1="69" y2="69" stroke="currentColor" opacity=".2"/><polyline fill="none" stroke="#70d9b5" strokeWidth="2.5" points={points}/></svg>;
}
export default function ReplayTournamentPanel(){
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){
  const r=await fetch('/api/arena/replay',{cache:'no-store'});
  const body=await r.json();if(!r.ok)throw Error(body.error||'Tournament unavailable');
  setData(body);
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 async function archive(symbol:string){
  setBusy(symbol);setError('');setNotice('');
  try{
   const r=await fetch('/api/market/intelligence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'archive-history',symbol})});
   const body=await r.json();if(!r.ok)throw Error(body.error||'Archive failed');
   await refresh();setNotice(symbol+' historical dataset archived. Existing snapshots are retained.');
  }catch(e){setError(e instanceof Error?e.message:'Archive failed')}finally{setBusy('')}
 }
 async function run(){
  setBusy('run');setError('');setNotice('');
  try{
   const r=await fetch('/api/arena/replay',{method:'POST'});
   const body=await r.json();if(!r.ok)throw Error(body.error||'Tournament failed');
   await refresh();setNotice('Historical simulation saved. Season 1 virtual accounts were not changed.');
  }catch(e){setError(e instanceof Error?e.message:'Tournament failed')}finally{setBusy('')}
 }
 const current=data?.runs[0]?.result;const ready=data?.coverage.every(x=>x.archive)&&data.coverage.length===4;
 const results=[...(current?.results??[])].sort((a,b)=>b.returnPct-a.returnPct);
 return <div className="atlas-phase6-panel" style={{marginTop:20}}>
  <div className="sectiontitle"><h2>Phase 11 · Historical Strategy Tournament</h2><span className="pill">SIMULATION ONLY</span></div>
  <p className="muted">An isolated, reproducible historical competition. Four single-stock proxies each begin with $5,000 virtual cash. These are experimental rule baselines, not full diversified strategies. Intraday agents remain paused.</p>
  <div className="arena-agent-grid">{(data?.coverage??REPLAY_PROXIES.map(x=>({...x,archive:null}))).map(item=><div className="arena-agent-card" key={item.slug}>
   <div className="arena-agent-title"><strong>{item.name}</strong><span>{item.archive?'Archived':'Data required'}</span></div>
   <p>{item.rule}</p>
   <div><strong>{item.symbol}</strong> · {item.archive?`${item.archive.observation_count} bars, last ${item.archive.last_date}`:'No versioned daily dataset yet'}</div>
   <button className="secondary" style={{marginTop:12}} disabled={!!busy} onClick={()=>archive(item.symbol)}>{busy===item.symbol?'Archiving…':item.archive?'Refresh source snapshot ↻':'Archive historical prices ↗'}</button>
  </div>)}</div>
  <div className="arena-actions" style={{marginTop:18}}>
   <div><h3>Point-in-time replay</h3><p>Common sessions only. Previous 20 closes inform decisions; modeled fills occur at the next session open with 10 bps slippage. Missing datasets stop the replay.</p></div>
   <button className="primary" disabled={!!busy||!ready} onClick={run}>{busy==='run'?'Running…':'Run virtual tournament ↗'}</button>
   <button className="secondary" disabled={!!busy} onClick={()=>refresh().catch(e=>setError(e.message))}>Reload results ↻</button>
  </div>
  {error&&<p className="market-alert" role="alert">{error}</p>}
  {notice&&<p className="monitor-success" role="status">{notice}</p>}
  {!ready&&<p className="atlas-warning">Archive all four required datasets to enable a common-session replay. Data requests may be limited by the Twelve Data plan.</p>}
  {current&&<><div className="sectiontitle" style={{marginTop:22}}><h2>Historical leaderboard</h2><span className="pill">{current.sessions} common sessions · {current.startDate} to {current.endDate}</span></div>
   <div className="arena-agent-grid">{results.map((r,i)=><article className="arena-agent-card" key={r.slug}>
    <div className="arena-agent-title"><strong>#{i+1} · {REPLAY_PROXIES.find(p=>p.slug===r.slug)?.name}</strong><span>{r.symbol}</span></div>
    <div className="arena-agent-stats"><div><small>Ending equity</small><strong>{usd(r.equity)}</strong></div><div><small>Historical return</small><strong>{r.returnPct.toFixed(2)}%</strong></div><div><small>Max drawdown</small><strong>{r.maxDrawdownPct.toFixed(2)}%</strong></div></div>
    <Spark values={r.curve.map(x=>x.equity)}/>
    <small>{r.orders.length} modeled buys · {r.shares} shares · {usd(r.endingCash)} cash</small>
    <details><summary>Simulated trades and reasoning</summary>{r.orders.length?r.orders.map((o,j)=><p className="micro" key={j}>{o.day}: BUY {o.shares} {o.symbol} @ {usd(o.fillPrice)} (signal {o.signalDate}) · {o.reason}</p>):<p>No eligible trades in this replay.</p>}</details>
   </article>)}</div>
   <p className="atlas-disclaimer">Experimental price-only proxy comparisons, not forward-paper performance. No commissions, taxes, dividends or verified corporate-action adjustments. Historical simulations may be affected by survivorship bias and are not evidence of future returns. Archived data identifiers and results are saved for reproducibility.</p>
  </>}
 </div>;
}
