'use client';
import {useEffect,useState} from 'react';
type Metric='price_above'|'price_below'|'daily_change_abs'|'volatility_above'|'volume_ratio_above';
type Rule={id:string;symbol:string;metric:Metric;threshold:number;enabled:boolean};
type Assessment={ruleId:string;symbol:string;metric:Metric;threshold:number;value:number|null;triggered:boolean;reason:string;asOf:string|null};
type Payload={rules:Rule[];assessments?:Assessment[];errors?:Record<string,string>;evaluatedAt?:string;note:string};
const labels:Record<Metric,string>={price_above:'Price above (USD)',price_below:'Price below (USD)',daily_change_abs:'Absolute daily move (%)',volatility_above:'20-session annualized volatility (%)',volume_ratio_above:'Relative volume (×)'};
export default function AlertsIntelligence(){
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [symbol,setSymbol]=useState('NVDA'),[metric,setMetric]=useState<Metric>('daily_change_abs'),[threshold,setThreshold]=useState('5');
 async function load(evaluate=false){
  setBusy(true);setError('');
  try{const r=await fetch('/api/alerts'+(evaluate?'?evaluate=true':''),{cache:'no-store'}),body=await r.json();if(!r.ok)throw Error(body.error||'Alert rules unavailable');setData(body)}
  catch(e){setError(e instanceof Error?e.message:'Alert rules unavailable')}finally{setBusy(false)}
 }
 useEffect(()=>{void load()},[]);
 async function save(){
  const limit=Number(threshold);
  if(!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(symbol.trim().toUpperCase())||!Number.isFinite(limit)||limit<=0){setError('Provide a valid symbol and positive threshold.');return}
  setBusy(true);setError('');
  try{const r=await fetch('/api/alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol:symbol.trim().toUpperCase(),metric,threshold:limit,enabled:true})});const body=await r.json();if(!r.ok)throw Error(body.error||'Unable to save');await load()}
  catch(e){setError(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}
 }
 async function remove(id:string){setBusy(true);try{const r=await fetch('/api/alerts?id='+encodeURIComponent(id),{method:'DELETE'});if(!r.ok)throw Error('Could not delete rule');await load()}catch(e){setError(e instanceof Error?e.message:'Delete failed')}finally{setBusy(false)}}
 return <section className="atlas-phase6">
  <div className="atlas-phase6-heading"><div><div className="eyebrow">WATCHLIST SIGNAL RULES / ON-DEMAND</div><h2>Define your <span className="gradient">attention thresholds.</span></h2><p>Store price, volatility or volume conditions and evaluate them against fetched market observations when you choose.</p></div>
   <button className="primary" disabled={busy} onClick={()=>void load(true)}>{busy?'Checking…':'Check rules now ↗'}</button></div>
  {error&&<p className="market-alert" role="alert">{error}</p>}
  <div className="atlas-phase6-panel"><h3>Create an alert rule</h3>
   <div className="atlas-phase6-fields">
    <label>Symbol<input maxLength={12} value={symbol} onChange={e=>setSymbol(e.target.value)}/></label>
    <label>Condition<select value={metric} onChange={e=>setMetric(e.target.value as Metric)}>{(Object.keys(labels) as Metric[]).map(k=><option value={k} key={k}>{labels[k]}</option>)}</select></label>
    <label>Threshold<input type="number" min="0" step="any" value={threshold} onChange={e=>setThreshold(e.target.value)}/></label>
    <button className="secondary" disabled={busy} onClick={()=>void save()}>Save rule</button>
   </div><p className="atlas-hint">Rules are unique by ticker and metric. Updating a rule replaces the prior threshold. Checking rules can consume market-provider credits.</p>
  </div>
  <div className="atlas-phase6-panel"><h3>Saved rules</h3>
   {!data?.rules.length&&<p className="muted">No alert rules have been saved yet.</p>}
   <div className="atlas-records">{data?.rules.map(r=>{const a=data.assessments?.find(x=>x.ruleId===r.id);return <div className="atlas-record" key={r.id}>
    <div><strong>{r.symbol}</strong><span>{labels[r.metric]} · {r.threshold.toLocaleString()}</span></div>
    <div><strong className={a?.triggered?'atlas-triggered':''}>{!a?'Not evaluated':a.triggered?'Threshold exceeded':a.value===null?'Not evaluable':'Within threshold'}</strong><span>{a?((a.value===null?'No metric':a.value.toFixed(2))+' · '+(a.asOf||'No observation time')):'Run Check rules now to evaluate'}</span></div>
    <button className="pill" disabled={busy} onClick={()=>void remove(r.id)}>Remove</button>
   </div>})}</div>
  </div><p className="atlas-disclaimer">These are manually checked conditions, not background notifications. No email, push or SMS delivery is configured, and no continuously monitored alerting is claimed.</p>
 </section>;
}
