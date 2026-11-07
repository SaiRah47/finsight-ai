'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
type Quote={symbol:string;name:string;exchange:string;currency:string;price:number;change:number|null;changePercent:number|null;previousClose:number|null;open:number|null;high:number|null;low:number|null;volume:number|null;fiftyTwoWeekHigh:number|null;fiftyTwoWeekLow:number|null;asOf:string|null;provider:string;fetchedAt:string};
type Bar={date:string;open:number;high:number;low:number;close:number;volume:number|null};
type History={bars:Bar[];symbol:string;interval:string;period:string;fetchedAt:string};
type Match={symbol:string;name:string;exchange:string;type:string};
type Period='1D'|'1W'|'1M'|'3M'|'1Y'|'5Y';
const periods:Period[]=['1D','1W','1M','3M','1Y','5Y'];
const money=(n:number|null,currency='USD')=>n===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(n);
const quantity=(n:number|null)=>n===null?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);
const pct=(n:number|null)=>n===null?'—':(n>0?'+':'')+n.toFixed(2)+'%';
async function getJson<T>(url:string,signal?:AbortSignal):Promise<T>{
 const res=await fetch(url,{signal,cache:'no-store'});
 const data=await res.json();
 if(!res.ok)throw Error(data.error||'Market data unavailable');
 return data as T;
}
function ChartArea({bars,period}:{bars:Bar[];period:Period}){
 const [hover,setHover]=useState<number|null>(null);
 const data=useMemo(()=>{
  if(!bars.length)return null;
  const closes=bars.map(b=>b.close),low=Math.min(...closes),high=Math.max(...closes);
  const min=low-(high-low||1)*.12,max=high+(high-low||1)*.12;
  const x=(i:number)=>50+i*860/Math.max(bars.length-1,1);
  const y=(n:number)=>290-((n-min)/(max-min))*230;
  const points=bars.map((b,i)=>[x(i),y(b.close)] as const);
  const line=points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2)).join(' ');
  const area=line+' L '+x(bars.length-1).toFixed(2)+',300 L 50,300 Z';
  return {points,line,area,min,max,x,y};
 },[bars]);
 const svgRef=useRef<SVGSVGElement>(null);
 if(!data)return <div className="market-empty">No historical prices for this period.</div>;
 const chosen=hover===null?bars.length-1:hover;
 const item=bars[chosen],xy=data.points[chosen];
 const starting=bars[0].close;
 const rising=bars[bars.length-1].close>=starting;
 const color=rising?'#87e4e8':'#f5a0b6';
 const pointerMove=(event:React.PointerEvent<SVGSVGElement>)=>{
  const rect=svgRef.current?.getBoundingClientRect();if(!rect)return;
  const viewX=(event.clientX-rect.left)*960/rect.width;
  setHover(Math.max(0,Math.min(bars.length-1,Math.round((viewX-50)/860*(bars.length-1)))));
 };
 return <div className="market-chart-wrap">
  <div className="market-chart-hover"><strong>{money(item.close)}</strong><span>{item.date.replace('T',' · ')} · {period}</span></div>
  <svg className="market-price-chart" ref={svgRef} viewBox="0 0 960 350" preserveAspectRatio="none" role="img" aria-label={period+' historical closing prices'} onPointerMove={pointerMove} onPointerLeave={()=>setHover(null)}>
   <defs><linearGradient id="market-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".26"/><stop offset="100%" stopColor={color} stopOpacity=".005"/></linearGradient></defs>
   {[0,1,2,3,4].map(i=><g key={i}><line x1="50" x2="910" y1={60+i*58} y2={60+i*58} stroke="#ffffff13" strokeDasharray="3 9"/><text x="44" y={64+i*58} fill="#8a91b1" fontSize="12" textAnchor="end">{(data.max-(data.max-data.min)*i/4).toFixed(0)}</text></g>)}
   <path d={data.area} fill="url(#market-chart-fill)"/>
   <path d={data.line} fill="none" stroke={color} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
   {hover!==null&&<><line x1={xy[0]} x2={xy[0]} y1="40" y2="300" stroke="#d1cdfb" strokeDasharray="5 7" opacity=".65"/><circle cx={xy[0]} cy={xy[1]} r="7" fill={color} stroke="#17182b" strokeWidth="3"/></>}
   <text x="50" y="334" fill="#9da3c1" fontSize="13">{bars[0].date.slice(0,10)}</text><text x="910" y="334" textAnchor="end" fill="#9da3c1" fontSize="13">{bars[bars.length-1].date.slice(0,10)}</text>
  </svg>
  <div className="market-chart-caption">{bars.length} observations · {rising?'Upward':'Downward'} across selected window · Source: Twelve Data</div>
 </div>;
}
export default function MarketExplorer({selectedSymbol='AAPL'}:{selectedSymbol?:string}){
 const [query,setQuery]=useState(''),[symbol,setSymbol]=useState(selectedSymbol),[period,setPeriod]=useState<Period>('1M');
 const [matches,setMatches]=useState<Match[]>([]),[searching,setSearching]=useState(false);
 const [quote,setQuote]=useState<Quote|null>(null),[history,setHistory]=useState<History|null>(null);
 const [quoteError,setQuoteError]=useState(''),[historyError,setHistoryError]=useState(''),[searchError,setSearchError]=useState('');
 const [loadingQuote,setLoadingQuote]=useState(true),[loadingHistory,setLoadingHistory]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();setLoadingQuote(true);setQuoteError('');setQuote(null);
  void getJson<Quote>('/api/market/quote?symbol='+encodeURIComponent(symbol),controller.signal).then(setQuote).catch(e=>{if(!controller.signal.aborted){setQuote(null);setQuoteError(e.message)}}).finally(()=>{if(!controller.signal.aborted)setLoadingQuote(false)});
  return ()=>controller.abort();
 },[symbol]);
 useEffect(()=>{
  const controller=new AbortController();setLoadingHistory(true);setHistoryError('');setHistory(null);
  void getJson<History>('/api/market/history?symbol='+encodeURIComponent(symbol)+'&period='+period,controller.signal).then(setHistory).catch(e=>{if(!controller.signal.aborted){setHistory(null);setHistoryError(e.message)}}).finally(()=>{if(!controller.signal.aborted)setLoadingHistory(false)});
  return ()=>controller.abort();
 },[symbol,period]);
 useEffect(()=>{
  if(query.trim().length<2){setMatches([]);setSearchError('');return}
  const controller=new AbortController();
  const timeout=setTimeout(()=>{
   setSearching(true);setSearchError('');
   void getJson<{results:Match[]}>('/api/market/search?q='+encodeURIComponent(query.trim()),controller.signal).then(d=>setMatches(d.results)).catch(e=>{if(!controller.signal.aborted){setMatches([]);setSearchError(e.message)}}).finally(()=>{if(!controller.signal.aborted)setSearching(false)});
  },550);
  return ()=>{clearTimeout(timeout);controller.abort()};
 },[query]);
 useEffect(()=>{setSymbol(selectedSymbol)},[selectedSymbol]);
 const select=(s:string)=>{setSymbol(s);setQuery('');setMatches([])};
 return <section className="market-explorer">
  <div className="market-section-head"><div><div className="eyebrow">MARKETS / RESEARCH TERMINAL</div><h2>Explore the market <span className="gradient">with clarity.</span></h2><p>Search US stocks, examine provider-reported quotes, and analyze historical market movement.</p></div><span className="market-provider-tag"><span className="market-provider-dot"/> TWELVE DATA · SERVER-SIDE</span></div>
  <div className="market-search-wrap">
   <div className="market-search-field"><span aria-hidden="true">⌕</span><input aria-label="Search stocks by symbol or company" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const direct=query.trim().toUpperCase();if(/^[A-Z][A-Z0-9.\-]{0,11}$/.test(direct))select(direct)}}} placeholder="Search company or ticker — AAPL, NVIDIA…" autoComplete="off"/>{searching&&<span className="market-mini-loading" aria-label="Searching"/>}</div>
   {query.trim().length>=2&&<div className="market-search-results" role="listbox" aria-label="Stock search results">
    {matches.map(m=><button key={m.symbol+'-'+m.exchange} onClick={()=>select(m.symbol)}><span><strong>{m.symbol}</strong><small>{m.name}</small></span><span className="market-match-exchange">{m.exchange||m.type}</span></button>)}
    {searchError&&<div className="market-search-message">{searchError}</div>}
    {!searching&&!searchError&&!matches.length&&<div className="market-search-message">No results yet. Enter a valid ticker and press Enter to load it directly.</div>}
   </div>}
  </div>
  <div className="market-quick-picks">{['AAPL','NVDA','MSFT','AMZN','GOOGL','SPY'].map(s=><button key={s} className={symbol===s?'selected':''} onClick={()=>select(s)}>{s}</button>)}</div>
  <div className="market-quote-header">
   <div><span className="market-symbol">{symbol}</span><span className="market-symbol-name">{quote?.name||'Market instrument'}</span></div>
   {loadingQuote?<div className="market-skeleton" style={{width:170,height:46}}/>:quote?<div className="market-quote-right"><strong>{money(quote.price,quote.currency)}</strong><span className={quote.change!==null&&quote.change<0?'down':'up'}>{quote.change===null?'Change unavailable':(quote.change>0?'+':'')+money(quote.change,quote.currency)+' ('+pct(quote.changePercent)+')'}</span></div>:null}
  </div>
  {quoteError&&<div className="market-alert" role="alert"><strong>Quote unavailable</strong><span>{quoteError}</span>{quoteError.includes('TWELVE_DATA_API_KEY')&&<a href="https://github.com/SaiRah47/finsight-ai/blob/main/docs/MARKET_DATA_SETUP.md" target="_blank" rel="noreferrer">Read connection instructions ↗</a>}</div>}
  <div className="market-chart-card">
   <div className="market-chart-top"><div><h3>Price history</h3><span>Actual provider observations · Not simulated</span></div><div className="market-periods" aria-label="Historical time range">{periods.map(p=><button key={p} aria-pressed={period===p} className={period===p?'selected':''} onClick={()=>setPeriod(p)}>{p}</button>)}</div></div>
   {loadingHistory?<div className="market-skeleton market-loading-chart" role="status" aria-label="Loading price history"/>:historyError?<div className="market-empty market-chart-error"><strong>Chart unavailable</strong><span>{historyError}</span><small>Try a different period. Some intraday intervals require a higher provider plan.</small></div>:history?<ChartArea bars={history.bars} period={period}/>:<div className="market-empty">No data available.</div>}
  </div>
  <div className="market-stats">
   {[['Open',quote?.open],['Day high',quote?.high],['Day low',quote?.low],['Previous close',quote?.previousClose],['52W high',quote?.fiftyTwoWeekHigh],['52W low',quote?.fiftyTwoWeekLow]].map(([label,value])=><div className="market-stat" key={String(label)}><span>{label}</span><strong>{money(typeof value==='number'?value:null,quote?.currency)}</strong></div>)}
   <div className="market-stat"><span>Volume</span><strong>{quantity(quote?.volume??null)}</strong></div>
   <div className="market-stat"><span>Exchange</span><strong>{quote?.exchange||'—'}</strong></div>
  </div>
  <div className="market-data-footer"><span>Source: Twelve Data · Latest provider observation: {quote?.asOf||'Not available'} · Retrieved: {quote?.fetchedAt?new Date(quote.fetchedAt).toLocaleString():'—'}</span><span>The provider's observation timestamp may lag behind the current time. Never assume quotes are live. Not investment advice.</span></div>
 </section>;
}
