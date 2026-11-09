'use client';
import {useEffect,useState} from 'react';
import {LEAGUE_PROFILES,LEAGUE_SYMBOLS,type LeagueTournament,type LeagueScore} from '@/lib/arena-diversified';
type Archive={id:string;observation_count:number;last_date:string}|null;
type Coverage={symbol:string;archive:Archive};
type Saved={id:string;created_at:string;result:LeagueTournament};
type Status={coverage:Coverage[];runs:Saved[]};
const usd=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
const pct=(n:number)=>n.toFixed(2)+'%';
function Curve({values}:{values:number[]}){
 const w=300,h=80;const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(1,hi-lo);
 const points=values.map((value,i)=>`${(i*w/Math.max(1,values.length-1)).toFixed(1)},${(h-5-(value-lo)/span*(h-10)).toFixed(1)}`).join(' ');
 return <svg viewBox="0 0 300 80" role="img" aria-label="Historical virtual equity curve" style={{width:'100%',height:84}}>
  <line x1="0" x2="300" y1="75" y2="75" stroke="currentColor" opacity=".15"/>
  <polyline points={points} stroke="#78d5cc" strokeWidth="2.6" fill="none"/></svg>;
}
function Competitor({score,rank,benchmark}:{score:LeagueScore;rank:number;benchmark:number}){
 return <article className="arena-agent-card">
  <div className="arena-agent-title"><strong>{rank===0?'Benchmark':`#${rank} · `+score.name}</strong><span>{score.symbols.join(' · ')}</span></div>
  <div className="arena-agent-stats">
   <div><small>End equity</small><strong>{usd(score.endingEquity)}</strong></div>
   <div><small>Return</small><strong>{pct(score.returnPct)}</strong></div>
   <div><small>Max drawdown</small><strong>{pct(score.maxDrawdownPct)}</strong></div>
  </div>
  <Curve values={score.curve.map(x=>x.equity)}/>
  <div className="arena-agent-stats">
   <div><small>vs SPY</small><strong>{rank===0?'Reference':(score.excessVsBenchmarkPct>0?'+':'')+pct(score.excessVsBenchmarkPct)}</strong></div>
   <div><small>Volatility annualized</small><strong>{score.annualizedVolatilityPct===null?'N/A':pct(score.annualizedVolatilityPct)}</strong></div>
   <div><small>Sharpe (0% RF)</small><strong>{score.sharpe0Pct===null?'N/A':score.sharpe0Pct.toFixed(2)}</strong></div>
  </div>
  <small>{score.trades.length} virtual fills · {usd(score.cash)} remaining cash · SPY reference {pct(benchmark)}</small>
  <details style={{marginTop:12}}><summary>Agent reasoning and counterarguments</summary>
   {score.debates.length?score.debates.slice(-45).map((e,i)=><div className="micro" key={i}><b>{e.day} · {e.role}</b> — {e.message} <small>Evidence through {e.signalDate}</small></div>):<p>Benchmark uses mechanical buy-and-hold without agent debates.</p>}
  </details>
  <details><summary>Simulated trade ledger</summary>
   {score.trades.length?score.trades.slice(-65).map((t,i)=><div className="micro" key={i}><strong>{t.day} · {t.side.toUpperCase()} {t.shares} {t.symbol}</strong> @ {usd(t.fillPrice)} · signal {t.signalDate}. {t.reason}</div>):<p>No eligible simulated fills.</p>}
  </details>
 </article>;
}
export default function DiversifiedLeague(){
 const [state,setState]=useState<Status|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[note,setNote]=useState('');
 const load=async()=>{const res=await fetch('/api/arena/diversified',{cache:'no-store'});const json=await res.json();
  if(!res.ok)throw Error(json.error||'Multi-stock tournament unavailable');setState(json)};
 useEffect(()=>{void load().catch(e=>setError(e.message))},[]);
 async function archive(symbol:string){
  setBusy(symbol);setError('');setNote('');
  try{
   const res=await fetch('/api/market/intelligence',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'archive-history',symbol})});
   const json=await res.json();if(!res.ok)throw Error(json.error||'Archive failed');
   await load();setNote(symbol+' historical snapshot saved without modifying other archives.');
  }catch(e){setError(e instanceof Error?e.message:'Archive failed')}finally{setBusy('')}
 }
 async function run(){
  if(!state){setError('Market dataset readiness is still loading. Use Reload history and try again.');return}
  setBusy('prepare');setError('');setNote('');
  const missing=state.coverage.filter(item=>!item.archive).map(item=>item.symbol);
  try{
   // Each archive has its own request: provider quotas and failures are surfaced
   // before the next symbol. Never infer or fabricate missing historical prices.
   for(let index=0;index<missing.length;index++){
    const symbol=missing[index];
    setNote('Preparing '+(index+1)+' / '+missing.length+': downloading and archiving '+symbol+'…');
    const res=await fetch('/api/market/intelligence',{method:'POST',
     headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'archive-history',symbol})});
    const body=await res.json();
    if(!res.ok)throw Error(symbol+' could not be archived: '+(body.error||'Provider request failed')+
      '. Saved datasets are retained; retry when the provider permits.');
   }
   if(missing.length)await load();
   setBusy('run');setNote('All '+LEAGUE_SYMBOLS.length+' datasets ready. Simulating four virtual portfolios against SPY…');
   const res=await fetch('/api/arena/diversified',{method:'POST'});
   const json=await res.json();
   if(!res.ok)throw Error(json.error||'Historical simulation could not complete');
   await load();
   setNote('Tournament completed and saved. Open the leaderboard below. Existing Season 1 accounts were not changed.');
  }catch(e){
   setError(e instanceof Error?e.message:'Tournament preparation failed');
   setNote('');
   // Preserve progress when a provider limit interrupts archiving.
   try{await load()}catch{}
  }finally{setBusy('')}
 }
 const ready=state?.coverage.length===LEAGUE_SYMBOLS.length&&state.coverage.every(x=>x.archive);
 const current=state?.runs[0]?.result;const leaderboard=[...(current?.results??[])].sort((a,b)=>b.returnPct-a.returnPct);
 const archived=state?.coverage.filter(x=>x.archive).length??0;
 const missing=LEAGUE_SYMBOLS.filter(symbol=>!state?.coverage.find(x=>x.symbol===symbol)?.archive);
 return <section className="atlas-phase6-panel" style={{marginTop:22}}>
  <div className="sectiontitle"><h2>Phase 11.2 · Multi-Stock Strategy League</h2><span className="pill">HISTORICAL · VIRTUAL ONLY</span></div>
  <p className="muted">Four independent $5,000 simulated portfolios with different deterministic rules; one SPY buy-and-hold benchmark. Compare return, risk, and dated strategy debates under identical daily-price execution assumptions. No broker or real orders.</p>
  <div className="arena-agent-grid">{LEAGUE_PROFILES.map(p=><div className="arena-agent-card" key={p.slug}>
   <div className="arena-agent-title"><strong>{p.name}</strong><span>{p.symbols.length} stocks</span></div>
   <p>{p.thesis}</p><small>{p.symbols.join(' · ')}</small>
  </div>)}</div>
  <div className="sectiontitle" style={{marginTop:20}}><h3>Data readiness</h3><span className="pill">{archived} / {LEAGUE_SYMBOLS.length} datasets</span></div>
  <p className="muted">The Prepare & Run control automatically archives missing source histories sequentially, then launches the tournament. Previously archived datasets are reused. Provider quota errors are displayed without fabricating prices.</p>
  <div className="arena-trader-grid">{LEAGUE_SYMBOLS.map(symbol=>{
   const found=state?.coverage.find(x=>x.symbol===symbol)?.archive;
   return <div key={symbol}><strong>{symbol} {symbol==='SPY'?'· BENCHMARK':''}</strong>
    <small>{found?`${found.observation_count} historical bars · ${found.last_date}`:'Not archived yet'}</small>
    <button className="secondary" disabled={!!busy} style={{marginTop:9}} onClick={()=>archive(symbol)}>
     {busy===symbol?'Saving…':found?'Refresh archive ↻':'Archive dataset ↗'}</button></div>;
  })}</div>
  <div className="arena-actions" style={{marginTop:18}}>
   <div><h3>Competition control</h3><p>Warm up 20 common sessions; rebalance every 20 sessions using past closes; modeled next-open fills with 10 bps slippage on buys and sells, whole shares, no margin.</p></div>
   <button className="primary" disabled={!!busy||!state} onClick={run} title={missing.length?'Will archive missing datasets first, then run the simulation':'Run the simulation on archived historical prices'}>{busy==='prepare'?'Preparing datasets…':busy==='run'?'Simulating…':!state?'Loading readiness…':ready?'Run multi-stock tournament ↗':'Prepare '+missing.length+' datasets & run ↗'}</button>
   <button className="secondary" disabled={!!busy} onClick={()=>load().catch(e=>setError(e.message))}>Reload history ↻</button>
  </div>
  {error&&<p className="market-alert" role="alert">{error}</p>}
  {note&&<p className="monitor-success" role="status" aria-live="polite">{note}</p>}
  {state&&!ready&&<p className="atlas-warning" role="status">Ready: {archived} of {LEAGUE_SYMBOLS.length} datasets. Missing: <strong>{missing.join(', ')}</strong>. Select <strong>Prepare {missing.length} datasets & run</strong> to fetch them in sequence and run automatically. If your Twelve Data quota is reached, the exact failed symbol will appear above; return later to resume.</p>}
  {current&&<><div className="sectiontitle" style={{marginTop:22}}><h3>Risk-adjusted leaderboard</h3><span className="pill">{current.sessions} shared sessions · {current.startDate} – {current.endDate}</span></div>
   <div className="arena-agent-grid">{leaderboard.map((score,i)=><Competitor key={score.slug} score={score} rank={i+1} benchmark={current.benchmark.returnPct}/>)}
    <Competitor score={current.benchmark} rank={0} benchmark={current.benchmark.returnPct}/></div>
   <details style={{marginTop:16}}><summary>Reproducible source snapshots and modeling limitations</summary>
    <p className="muted">Each result identifies the archived market datasets and their fingerprints:</p>
    {current.dataSources.map(s=><p className="micro" key={s.symbol}>{s.symbol} · {s.datasetId} · SHA-256: {s.checksum.slice(0,16)}…</p>)}
    {current.limitations.map((s,i)=><p className="micro" key={i}>• {s}</p>)}
   </details></>}
  <p className="atlas-disclaimer">Simulation experiment only. Deterministic rule-based agents, NOT live autonomous financial advisers. Trading league remains paused. Historical price-only returns may be misleading without verified corporate-action adjustments, dividends, and survivorship-bias controls.</p>
 </section>;
}
