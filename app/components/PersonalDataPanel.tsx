'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {browserDb} from '@/lib/supabase/browser';
type SymbolRow={id:string;symbol:string;created_at:string};
type Run={id:string;question:string;route:string;answer:string;created_at:string};
type Trace={id:string;run_id:string;events:unknown;created_at:string};
export default function PersonalDataPanel({mode,onSelectSymbol}:{mode:'watchlist'|'history';onSelectSymbol?:(symbol:string)=>void}){
 const db=browserDb();
 const [symbols,setSymbols]=useState<SymbolRow[]>([]),[runs,setRuns]=useState<Run[]>([]),[traces,setTraces]=useState<Trace[]>([]);
 const [symbol,setSymbol]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function load(){
  if(!db)return;
  setLoading(true);setError('');
  if(mode==='watchlist'){
   const {data,error:e}=await db.from('watchlist_symbols').select('id,symbol,created_at').order('created_at',{ascending:false}).limit(100);
   if(e)setError(e.message);else setSymbols(data||[]);
  }else{
   const [a,b]=await Promise.all([
    db.from('research_runs').select('id,question,route,answer,created_at').order('created_at',{ascending:false}).limit(20),
    db.from('execution_traces').select('id,run_id,events,created_at').order('created_at',{ascending:false}).limit(20)
   ]);
   if(a.error||b.error)setError(a.error?.message||b.error?.message||'Failed loading history');
   else{setRuns(a.data||[]);setTraces(b.data||[])}
  }
  setLoading(false);
 }
 useEffect(()=>{void load()},[mode]); 
 async function add(e:FormEvent){
  e.preventDefault();if(!db)return;
  const value=symbol.trim().toUpperCase();
  if(!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(value)){setError('Enter a valid symbol, such as AAPL or BRK.B.');return}
  const {data:{user}}=await db.auth.getUser();
  if(!user){setError('Session expired. Please sign in again.');return}
  const {error:insertError}=await db.from('watchlist_symbols').insert({user_id:user.id,symbol:value});
  if(insertError)setError(insertError.code==='23505'?'Already in your watchlist.':insertError.message);else{setSymbol('');void load()}
 }
 async function remove(id:string){
  if(!db)return;
  const {error:e}=await db.from('watchlist_symbols').delete().eq('id',id);
  if(e)setError(e.message);else void load();
 }
 if(!db)return <section className="vault-card"><h2>Private data vault</h2><p className="muted">Connect Supabase to save watchlists, research and execution histories. Current market data is synthetic.</p></section>;
 return <section className="vault-card"><div className="sectiontitle"><h2>{mode==='watchlist'?'Your saved watchlist':'Research & trace history'}</h2><button className="pill" disabled={loading} onClick={()=>void load()}>{loading?'Loading…':'Refresh ↻'}</button></div>
 {mode==='watchlist'?<><form onSubmit={add} className="vault-add"><label htmlFor="symbol-input">Add a stock or ETF</label><div className="inputrow"><input id="symbol-input" value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="NVDA" maxLength={12}/><button className="primary">Add symbol</button></div></form>
 {symbols.length===0&&<p className="muted">No saved symbols. Add a ticker to build your personal watchlist.</p>}
 {symbols.map(row=><div className="watchrow" key={row.id}><button className="ticker saved-symbol-link" type="button" onClick={()=>onSelectSymbol?.(row.symbol)} aria-label={'Open '+row.symbol+' price chart'}>{row.symbol} <span aria-hidden="true">↗</span></button><button className="pill" onClick={()=>void remove(row.id)}>Remove</button></div>)}</>:
 <>{runs.length===0&&<p className="muted">No saved research yet. Execute a LangGraph workflow and refresh this panel.</p>}
 {runs.map(run=>{
  const recorded=traces.find(t=>t.run_id===run.id)?.events;
  const timeline=Array.isArray(recorded)?recorded:[] as unknown[];
  const evidence=timeline.find((item:unknown)=>item&&typeof item==='object'&&!Array.isArray(item)&&(item as {step?:unknown}).step==='evidence') as {sources?:unknown}|undefined;
  const links=(Array.isArray(evidence?.sources)?evidence.sources:[]).filter((value:unknown)=>{
   if(!value||typeof value!=='object'||Array.isArray(value))return false;
   const url=(value as {url?:unknown}).url;
   return typeof url==='string'&&(url.startsWith('https://www.sec.gov/Archives/edgar/data/')||url==='https://twelvedata.com');
  }) as {id:string;url:string;label:string;date:string|null}[];
  return <details className="history-row" key={run.id}><summary><strong>{run.question}</strong><span>{new Date(run.created_at).toLocaleString()} · {run.route}</span></summary>
   <p className="research-historical-answer">{run.answer}</p>
   {links.length>0&&<div className="historical-sources"><strong>Saved evidence sources</strong>{links.map(source=><a href={source.url} target="_blank" rel="noreferrer" key={source.id+source.url}><span>{source.id}</span> {source.label} ↗</a>)}</div>}
   <details className="raw-trace"><summary>View raw execution events</summary><pre>{JSON.stringify(timeline,null,2)}</pre></details>
  </details>
 })}</>}
 {error&&<p className="vault-error" role="alert">{error}</p>}</section>;
}