'use client';
import {useEffect,useMemo,useState} from 'react';
type Quote={price:number;changePercent:number|null;asOf:string|null;currency:string};
type History={bars:{date:string;close:number}[]};
export default function MarketSnapshot({onExplore}:{onExplore:()=>void}){
 const [quote,setQuote]=useState<Quote|null>(null),[bars,setBars]=useState<{date:string;close:number}[]>([]);
 const [pending,setPending]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  void(async()=>{
   try{
    const [a,b]=await Promise.all([fetch('/api/market/quote?symbol=SPY'),fetch('/api/market/history?symbol=SPY&period=1M')]);
    const [q,h]=await Promise.all([a.json(),b.json()]);
    if(!a.ok||!b.ok)throw Error(q.error||h.error||'Benchmark data not available.');
    if(active){setQuote(q);setBars(h.bars||[])}
   }catch(e){if(active)setError(e instanceof Error?e.message:'Benchmark data not available.')}
   finally{if(active)setPending(false)}
  })();
  return ()=>{active=false};
 },[]);
 const coords=useMemo(()=>{
  if(bars.length<2)return null;
  const values=bars.map(x=>x.close),min=Math.min(...values),max=Math.max(...values),span=max-min||1;
  const points=values.map((v,i)=>[i*720/(values.length-1),176-(v-min)/span*144]);
  const d=points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  return {line:d,area:d+' L 720 190 L 0 190 Z'};
 },[bars]);
 const diff=quote?.changePercent;
 return <div className="card market-snapshot"><div className="sectiontitle"><h2>Market benchmark</h2><span className="pill">SPY · 1M</span></div>
  {pending?<div className="market-skeleton" style={{height:210}}/>:error?<div className="snapshot-unavailable"><strong>Live market feed not connected</strong><span>{error}</span><button className="secondary" onClick={onExplore}>Open market explorer ↗</button></div>:<>
   <div className="snapshot-quote"><div><span>S&P 500 ETF · SPY</span><strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:quote?.currency||'USD'}).format(quote?.price||0)}</strong></div><span className={diff!==null&&diff!==undefined&&diff<0?'down':'up'}>{diff===null||diff===undefined?'Change unavailable':(diff>0?'+':'')+diff.toFixed(2)+'%'}</span></div>
   {coords&&<svg viewBox="0 0 720 200" preserveAspectRatio="none" className="snapshot-chart" aria-label="SPY one-month closing prices" role="img"><defs><linearGradient id="snapshot-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#87e4e8" stopOpacity=".25"/><stop offset="1" stopColor="#87e4e8" stopOpacity="0"/></linearGradient></defs><path d={coords.area} fill="url(#snapshot-fill)"/><path d={coords.line} fill="none" stroke="#87e4e8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg>}
   <p className="muted">Twelve Data · Latest provider quote: {quote?.asOf||'timestamp unavailable'} · Historical close series</p>
   <button className="pill" onClick={onExplore}>Explore symbols and full history ↗</button>
  </>}
 </div>;
}