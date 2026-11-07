'use client';
import {useEffect,useState} from 'react';
import {browserDb} from '@/lib/supabase/browser';
type Quote={symbol:string;price:number;changePercent:number|null;name:string;currency:string;asOf:string|null};
type Result={symbol:string;quote:Quote|null;error:string|null};
export default function WatchlistLive({onSelect}:{onSelect:(symbol:string)=>void}){
 const [symbols,setSymbols]=useState<string[]>([]);
 const [results,setResults]=useState<Result[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  async function run(){
   const db=browserDb();if(!db){setLoading(false);return}
   setLoading(true);setError('');
   const {data,error:readError}=await db.from('watchlist_symbols').select('symbol').order('created_at',{ascending:false}).limit(4);
   if(!active)return;
   if(readError){setError(readError.message);setLoading(false);return}
   const names=(data||[]).map(r=>String(r.symbol));
   setSymbols(names);
   if(!names.length){setResults([]);setLoading(false);return}
   try{
    const res=await fetch('/api/market/watchlist?symbols='+encodeURIComponent(names.join(',')),{cache:'no-store'});
    const payload=await res.json();
    if(!res.ok)throw Error(payload.error||'Watchlist quote lookup failed');
    if(active)setResults(payload.results||[]);
   }catch(e){if(active)setError(e instanceof Error?e.message:'Unable to load watchlist')}
   finally{if(active)setLoading(false)}
  }
  void run();return ()=>{active=false};
 },[]);
 return <div className="card market-watchlist-card"><div className="sectiontitle"><h2>Saved watchlist · market pulse</h2><span className="pill">Latest available</span></div>
 {loading?<div className="market-skeleton" style={{height:110}}/>:error?<div className="market-watch-error">{error}</div>:!symbols.length?<p className="muted">Your watchlist is empty. Add symbols from the Markets tab to see their prices here.</p>:results.map(r=><div className="watchrow" key={r.symbol}><div><button className="ticker saved-symbol-link" onClick={()=>onSelect(r.symbol)} aria-label={'Explore '+r.symbol+' historical price chart'}>{r.symbol} ↗</button><small style={{display:'block',marginTop:3}}>{r.quote?.name||'No quote'}</small></div><div className="market-watch-right"><strong>{r.quote?new Intl.NumberFormat('en-US',{style:'currency',currency:r.quote.currency||'USD'}).format(r.quote.price):'—'}</strong><small className={r.quote?.changePercent!==null&&r.quote?.changePercent!==undefined&&r.quote.changePercent<0?'down':'up'}>{r.quote?.changePercent!==null&&r.quote?.changePercent!==undefined?(r.quote.changePercent>0?'+':'')+r.quote.changePercent.toFixed(2)+'%':r.error||'Change unavailable'}</small></div></div>)}
 <p className="market-watch-disclaimer">Saved symbols from Supabase · Observation times: {results.filter(r=>r.quote?.asOf).map(r=>r.symbol+': '+r.quote?.asOf).join(' · ')||'not reported'}. Prices may be delayed; refresh after quota resets.</p>
 </div>;
}
