'use client';
import {useState} from 'react';
import {browserDb} from '@/lib/supabase/browser';

type Metric={id:string;label:string;value:number|null;unit:'percent'|'multiple';status:string;explanation:string;observations:number};
type Study={eventCount:number;eligibleSessions:number;threshold:number;horizonSessions:number;meanEventReturnPercent:number|null;positiveEventRatePercent:number|null;unconditionalMeanReturnPercent:number|null;caveat:string};
type Report={symbol:string;sampleCount:number;lastDate:string|null;latestClose:number|null;metrics:Metric[];eventStudy?:Study;
 attentionScore:number|null;attentionLabel:string;scoreBreakdown:{name:string;points:number;max:number;reason:string}[];
 warnings:string[];closes:{date:string;close:number}[];dataSource:string;methodology:string};
type Result={symbol:string;report:Report|null;error:string|null};
type ApiResult={results:Result[];fetchedAt:string};

function Stat({metric}:{metric:Metric}){
 const displayed=metric.value===null?'Unavailable':(metric.value>0&&metric.id.startsWith('momentum')?'+':'')+metric.value.toFixed(metric.unit==='multiple'?2:1)+(metric.unit==='multiple'?'×':'%');
 return <div className={'radar-metric radar-metric-'+metric.status}><span>{metric.label}</span><strong>{displayed}</strong><small>{metric.explanation}</small></div>;
}
function Sparkline({values}:{values:{date:string;close:number}[]}){
 if(values.length<2)return null;
 const closes=values.map(v=>v.close),min=Math.min(...closes),max=Math.max(...closes),spread=max-min||1;
 const path=values.map((v,i)=>(i===0?'M':'L')+(i*400/(values.length-1)).toFixed(2)+' '+(95-(v.close-min)/spread*72).toFixed(2)).join(' ');
 const rising=closes[closes.length-1]>=closes[0];
 return <svg viewBox="0 0 400 115" preserveAspectRatio="none" className="radar-sparkline" role="img" aria-label="Recent historical closing price trajectory"><path d={path} fill="none" stroke={rising?'#87e4e8':'#f5a0b6'} strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></svg>;
}
export default function OpportunityRadar({onExplore}:{onExplore:(symbol:string)=>void}){
 const [symbols,setSymbols]=useState('AAPL,NVDA,MSFT,SPY');
 const [results,setResults]=useState<Result[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [lastRun,setLastRun]=useState('');
 const [hasRun,setHasRun]=useState(false);
 const [expanded,setExpanded]=useState<string[]>([]);
 async function runScan(input?:string[]){
  const target=(input||symbols.split(',')).map(v=>v.trim().toUpperCase()).filter(Boolean);
  if(target.length<1||target.length>4||new Set(target).size!==target.length||target.some(s=>!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(s))){
   setError('Enter 1–4 distinct tickers separated by commas, such as AAPL,NVDA.');return;
  }
  setLoading(true);setError('');setResults([]);setHasRun(true);
  try{
   const res=await fetch('/api/radar?symbols='+encodeURIComponent(target.join(',')),{cache:'no-store'});
   const body=await res.json() as ApiResult&{error?:string};
   if(!res.ok)throw Error(body.error||'Signal scan failed');
   setResults(body.results);
   setLastRun(body.fetchedAt);
   setSymbols(target.join(','));
  }catch(e){setError(e instanceof Error?e.message:'Signal scan unavailable')}
  finally{setLoading(false)}
 }
 async function loadSaved(){
  const db=browserDb();if(!db){setError('Supabase is not connected.');return}
  setError('');
  const {data,error:dbError}=await db.from('watchlist_symbols').select('symbol').order('created_at',{ascending:false}).limit(4);
  if(dbError){setError(dbError.message);return}
  const values=(data||[]).map(r=>String(r.symbol).toUpperCase());
  if(!values.length){setError('Your saved watchlist is empty. Add a symbol in Markets first.');return}
  setSymbols(values.join(','));void runScan(values);
 }
 const toggle=(symbol:string)=>setExpanded(list=>list.includes(symbol)?list.filter(v=>v!==symbol):[...list,symbol]);
 return <section className="radar-screen">
  <div className="radar-intro"><div><div className="eyebrow">ATLAS SIGNAL INTELLIGENCE / RULES V1</div><h2>Opportunity <span className="gradient">Radar.</span></h2><p>Identify unusual historical market activity. Transparent statistics, no black-box predictions or trade recommendations.</p></div><span className="radar-method-pill">Historical signals · On demand</span></div>
  <div className="radar-scan-control">
   <div className="radar-input-area"><label htmlFor="radar-symbols">Symbols to evaluate (up to 4)</label><input id="radar-symbols" value={symbols} maxLength={60} onChange={e=>setSymbols(e.target.value)} placeholder="AAPL,NVDA,MSFT,SPY" spellCheck={false}/></div>
   <div className="radar-buttons"><button className="primary" type="button" disabled={loading} onClick={()=>void runScan()}>{loading?'Analyzing…':'Run signal scan ↗'}</button><button className="secondary" type="button" disabled={loading} onClick={()=>void loadSaved()}>Scan saved watchlist</button></div>
   <p>Runs only when requested. Uses cached daily price histories and deliberately omits the current US trading-day bar.</p>
  </div>
  {loading&&<div className="radar-loading" role="status"><div className="market-skeleton" style={{height:96}}/><div className="market-skeleton" style={{height:96}}/><span>Calculating historical indicators…</span></div>}
  {error&&<div className="market-alert" role="alert"><strong>Scan unavailable</strong><span>{error}</span></div>}
  {!hasRun&&<div className="radar-empty"><span aria-hidden="true">✧</span><h3>Signals begin with evidence.</h3><p>Run a scan to inspect momentum, volume, volatility and drawdown. Results use actual provider bars; no placeholder scores are shown.</p></div>}
  {!loading&&results.length>0&&<><div className="radar-summary"><strong>{results.filter(x=>x.report?.attentionScore!==null&&x.report?.attentionScore!==undefined).length} evaluated</strong><span>Run: {lastRun?new Date(lastRun).toLocaleString():'—'}</span><span>Source: Twelve Data · Daily sessions</span></div>
    <div className="radar-result-grid">{results.map(({symbol,report,error:resultError})=><article className="radar-card" key={symbol}>
     <div className="radar-card-head"><div><small>MARKET ACTIVITY / {symbol}</small><h3>{symbol}</h3></div><button className="radar-chart-link" onClick={()=>onExplore(symbol)}>Open price chart ↗</button></div>
     {resultError||!report?<div className="radar-card-error"><strong>Not evaluated</strong><p>{resultError||'Historical data unavailable.'}</p></div>:<>
      <div className="radar-score-line"><div><strong>{report.attentionScore===null?'—':report.attentionScore}<span>{report.attentionScore===null?'':' / 100'}</span></strong><small>Activity score · {report.attentionLabel}</small></div><span className="radar-history-date">Last complete bar<br/>{report.lastDate||'Unknown'}</span></div>
      <div className="radar-score-rail"><div style={{width:(report.attentionScore??0)+'%'}}/></div>
      <Sparkline values={report.closes}/>
      {report.eventStudy&&<div className="radar-study"><div className="radar-study-header"><strong>Historical event study</strong><span>5 completed sessions ahead</span></div>
       {report.eventStudy.eventCount>0?<div className="radar-study-grid">
        <div><span>Higher-activity events</span><strong>{report.eventStudy.eventCount}</strong></div>
        <div><span>Mean forward change</span><strong>{report.eventStudy.meanEventReturnPercent?.toFixed(2)}%</strong></div>
        <div><span>Positive observations</span><strong>{report.eventStudy.positiveEventRatePercent?.toFixed(1)}%</strong></div>
        <div><span>Unconditional baseline</span><strong>{report.eventStudy.unconditionalMeanReturnPercent?.toFixed(2)??'—'}%</strong></div>
       </div>:<p className="radar-no-events">No historical high-activity observations meet the threshold in the available sample; no outcome rate is reported.</p>}
       <p>{report.eventStudy.eligibleSessions} eligible sessions · Overlapping outcomes · Exploratory, not a trading backtest or forecast</p>
      </div>}
      <div className="radar-metric-grid">{report.metrics.map(metric=><Stat key={metric.id} metric={metric}/>)}</div>
      <button className="radar-details-toggle" aria-expanded={expanded.includes(symbol)} onClick={()=>toggle(symbol)}>{expanded.includes(symbol)?'Hide':'Show'} score methodology <span aria-hidden="true">{expanded.includes(symbol)?'−':'+'}</span></button>
      {expanded.includes(symbol)&&<div className="radar-method-details"><p>Score = absolute 20-day momentum (30 points) + relative volume (25) + realized volatility (25) + historical drawdown (20). Each contribution is capped. This measures activity, not prospective performance.</p>
       {report.scoreBreakdown.map(s=><div className="radar-breakdown-row" key={s.name}><span>{s.name}<small>{s.reason}</small></span><strong>{s.points} / {s.max}</strong></div>)}
       {report.warnings.map(w=><p className="radar-warning" key={w}>{w}</p>)}
      </div>}
      <p className="radar-footnote">{report.sampleCount} completed daily bars · Data: {report.dataSource} · Close-to-close metrics, not total return</p>
     </>}
    </article>)}</div>
   </>}
  <p className="radar-disclaimer">These indicators describe past price and trading activity. A high activity score is not bullish, a forecast, an investment recommendation, or a backtested trading strategy. The watchlist scan is limited to four symbols to respect free-tier quotas.</p>
 </section>;
}
