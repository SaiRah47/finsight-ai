'use client';
import {useEffect,useState} from 'react';
type Holding={id:string;symbol:string;shares:number;cost_basis_per_share:number|null;notes:string};
type Position={symbol:string;shares:number;price:number;marketValue:number;costBasis:number|null;unrealizedPnL:number|null;weightPct:number;asOf:string|null};
type PortfolioData={holdings:Holding[];valuation:{positions:Position[];totalValue:number|null;pricedCount:number;unpricedSymbols:string[];topWeightPct:number|null;concentrationHHI:number|null;unrealizedPnL:number|null;coverageComplete:boolean};quoteErrors:Record<string,string>;note:string};
type Risk={sampleDays:number;startDate:string;endDate:string;annualizedVolatilityPct:number;largestDailyLossPct:number;largestDailyGainPct:number;approximation:string};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
export default function PortfolioIntelligence({onExplore}:{onExplore:(s:string)=>void}){
 const [data,setData]=useState<PortfolioData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [symbol,setSymbol]=useState(''),[shares,setShares]=useState(''),[basis,setBasis]=useState(''),[busy,setBusy]=useState(false);
 const [risk,setRisk]=useState<Risk|null>(null),[riskBusy,setRiskBusy]=useState(false),[riskError,setRiskError]=useState('');
 async function loadRisk(){
  setRiskBusy(true);setRiskError('');setRisk(null);
  try{
   const r=await fetch('/api/portfolio/risk',{cache:'no-store'}),body=await r.json();
   if(!r.ok||body.error)throw Error(body.error||'Historical risk unavailable');
   if(!body.risk)throw Error('Insufficient aligned completed daily sessions for this portfolio.');
   setRisk(body.risk);
  }catch(e){setRiskError(e instanceof Error?e.message:'Historical risk unavailable')}
  finally{setRiskBusy(false)}
 }
 async function load(){
  setLoading(true);setError('');
  try{const res=await fetch('/api/portfolio',{cache:'no-store'}),body=await res.json();if(!res.ok)throw Error(body.error||'Portfolio not available');setData(body)}
  catch(e){setError(e instanceof Error?e.message:'Could not load portfolio')}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 async function save(){
  const count=Number(shares),cost=basis.trim()?Number(basis):null;
  if(!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(symbol.trim().toUpperCase())||!Number.isFinite(count)||count<=0||count>100_000_000||(cost!==null&&(!Number.isFinite(cost)||cost<0))){setError('Enter a valid ticker, positive share quantity, and optional nonnegative cost basis.');return}
  setBusy(true);setError('');
  try{const r=await fetch('/api/portfolio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol:symbol.trim().toUpperCase(),shares:count,cost_basis_per_share:cost})});const body=await r.json();if(!r.ok)throw Error(body.error||'Unable to save');setSymbol('');setShares('');setBasis('');setRisk(null);await load()}
  catch(e){setError(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}
 }
 async function remove(id:string){setBusy(true);try{const r=await fetch('/api/portfolio?id='+encodeURIComponent(id),{method:'DELETE'});if(!r.ok)throw Error('Delete failed');setRisk(null);await load()}catch(e){setError(e instanceof Error?e.message:'Delete failed')}finally{setBusy(false)}}
 const valuation=data?.valuation;
 return <section className="atlas-phase6">
  <div className="atlas-phase6-heading"><div><div className="eyebrow">PORTFOLIO INTELLIGENCE / OWNER-ONLY</div><h2>Your holdings, <span className="gradient">in context.</span></h2><p>Manually record share quantities and optional per-share costs. Indicative quotes are fetched from Twelve Data; no brokerage is connected.</p></div><button className="secondary" onClick={()=>void load()} disabled={loading}>Refresh quotes ↻</button></div>
  {error&&<p role="alert" className="market-alert">{error}</p>}
  <div className="atlas-phase6-kpis">
   <div><small>Indicative portfolio value</small><strong>{valuation?.totalValue===null||!valuation?'Unavailable':money(valuation.totalValue)}</strong><span>{valuation?.coverageComplete?'All entered positions priced':'Incomplete quote coverage'}</span></div>
   <div><small>Unrealized P/L</small><strong>{valuation?.unrealizedPnL===null||!valuation?'Unavailable':money(valuation.unrealizedPnL)}</strong><span>Excludes fees, taxes, dividends and transactions</span></div>
   <div><small>Largest weight</small><strong>{valuation?.topWeightPct===null||!valuation?'—':valuation.topWeightPct.toFixed(1)+'%'}</strong><span>Concentration across priced holdings</span></div>
   <div><small>HHI concentration</small><strong>{valuation?.concentrationHHI===null||!valuation?'—':valuation.concentrationHHI.toFixed(3)}</strong><span>1.0 = single-position concentration</span></div>
  </div>
  <div className="atlas-phase6-panel"><div className="sectiontitle"><h3>Historical portfolio risk</h3><button className="pill" disabled={riskBusy} onClick={()=>void loadRisk()}>{riskBusy?'Analyzing…':'Calculate historical risk ↗'}</button></div>
   <p className="atlas-hint">Optional provider-data analysis of up to four entered positions, using their current estimated weights and aligned daily returns. Calculations may consume Twelve Data credits.</p>
   {riskError&&<p className="atlas-warning" role="alert">{riskError}</p>}
   {risk&&<div className="atlas-risk-snapshot"><div><small>Annualized realized volatility</small><strong>{risk.annualizedVolatilityPct.toFixed(2)}%</strong></div><div><small>Worst observed daily return</small><strong>{risk.largestDailyLossPct.toFixed(2)}%</strong></div><div><small>Best observed daily return</small><strong>{risk.largestDailyGainPct.toFixed(2)}%</strong></div><p>{risk.sampleDays} intersecting daily observations from {risk.startDate} to {risk.endDate}. {risk.approximation}</p></div>}
  </div>
  <div className="atlas-phase6-panel"><h3>Add or update a holding</h3>
   <div className="atlas-phase6-fields"><label>Symbol<input value={symbol} onChange={e=>setSymbol(e.target.value)} maxLength={12} placeholder="NVDA"/></label>
    <label>Shares<input type="number" min="0.00000001" step="any" value={shares} onChange={e=>setShares(e.target.value)} placeholder="10"/></label>
    <label>Cost per share (USD, optional)<input type="number" min="0" step="any" value={basis} onChange={e=>setBasis(e.target.value)} placeholder="120"/></label>
    <button className="primary" disabled={busy} onClick={()=>void save()}>Save holding</button>
   </div><p className="atlas-hint">Each ticker has one position. Saving an existing symbol replaces its quantity and cost basis. These are user-entered records, not imported transactions.</p>
  </div>
  <div className="atlas-phase6-panel"><h3>Recorded positions</h3>
   {loading&&<p className="muted">Retrieving saved positions and provider quotes…</p>}
   {data?.holdings.length===0&&<p className="muted">No holdings entered. Your portfolio remains empty until you add them.</p>}
   <div className="atlas-records">{data?.holdings.map(h=>{const item=valuation?.positions.find(p=>p.symbol===h.symbol);
    return <div className="atlas-record" key={h.id}><div><button className="ticker saved-symbol-link" onClick={()=>onExplore(h.symbol)}>{h.symbol} ↗</button><span>{h.shares.toLocaleString()} shares · {h.cost_basis_per_share===null?'Cost unknown':money(h.cost_basis_per_share)+' avg cost'}</span></div>
     <div><strong>{item?money(item.marketValue):'Quote unavailable'}</strong><span>{item?'Weight '+item.weightPct.toFixed(1)+'% · '+(item.asOf||'Provider date unavailable'):data?.quoteErrors[h.symbol]||'Awaiting quote'}</span></div>
     <button className="pill" disabled={busy} onClick={()=>void remove(h.id)}>Remove</button></div>})}</div>
   {!!valuation?.unpricedSymbols.length&&<p className="atlas-warning">Missing or unsupported USD quotes: {valuation.unpricedSymbols.join(', ')}. No complete portfolio value is displayed.</p>}
  </div><p className="atlas-disclaimer">Portfolio math is descriptive, not a performance backtest or financial advice. Quotes may be delayed. Portfolio volatility, correlation and diversification cannot be inferred from weight concentration alone.</p>
 </section>;
}
