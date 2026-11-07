'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {browserDb} from '@/lib/supabase/browser';
type SymbolRow={id:string;symbol:string;created_at:string};
type Run={id:string;question:string;route:string;answer:string;created_at:string};
type Trace={id:string;run_id:string;events:unknown;created_at:string};
export default function PersonalDataPanel({mode}:{mode:'watchlist'|'history'}){
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
  const {error:e}=await db.from('watchlist_symbols').insert({user_id:user.id,symbol:value});
  if(e)setError(e.code==='23505'?'Already in your watchlist.':e.message);else{setSymbol('');void load()}
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
 {symbols.map(row=><div className="watchrow" key={row.id}><span className="ticker">{row.symbol}</span><button className="pill" onClick={()=>void remove(row.id)}>Remove</button></div>)}</>:
 <>{runs.length===0&&<p className="muted">No saved research yet. Execute a LangGraph workflow and refresh this panel.</p>}
 {runs.map(run=><details className="history-row" key={run.id}><summary><strong>{run.question}</strong><span>{new Date(run.created_at).toLocaleString()} · {run.route}</span></summary><p>{run.answer}</p><pre>{JSON.stringify(traces.find(t=>t.run_id===run.id)?.events??[],null,2)}</pre></details>)}</>}
 {error&&<p className="vault-error" role="alert">{error}</p>}</section>;
}