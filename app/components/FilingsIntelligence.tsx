'use client';
import {useState} from 'react';
type Filing={id:string;form:string;filed:string;reportDate:string|null;url:string;description:string};
type Fact={id:string;label:string;value:number;unit:string;end:string;filed:string;form:string;url:string};
type Passage={id:string;section:string;text:string;score:number;start:number;form:string;filed:string;url:string;accession:string};
type PassageData={passages:Passage[];attempted:number;warnings:string[];retrievalMethod:string};
type SEC={symbol:string;name:string;cik:string;filings:Filing[];facts:Fact[];source:'SEC EDGAR';fetchedAt:string;warnings:string[]};

const safeLink=(url:string)=>url.startsWith('https://www.sec.gov/Archives/edgar/data/')?url:null;
const humanCurrency=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value);
export default function FilingsIntelligence({onResearch}:{onResearch?:(question:string)=>void}){
 const [symbol,setSymbol]=useState('NVDA'),[data,setData]=useState<SEC|null>(null);
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[filter,setFilter]=useState('All');
 const [passageQuery,setPassageQuery]=useState('What are the main risk factors and competitive threats?');
 const [passageData,setPassageData]=useState<PassageData|null>(null);
 const [passageError,setPassageError]=useState(''),[passageBusy,setPassageBusy]=useState(false);
 async function searchPassages(){
  if(!data||passageQuery.trim().length<4)return;
  setPassageBusy(true);setPassageError('');setPassageData(null);
  try{
   const url='/api/sec/passages?symbol='+encodeURIComponent(data.symbol)+'&q='+encodeURIComponent(passageQuery.trim());
   const r=await fetch(url,{cache:'no-store'});const body=await r.json();
   if(!r.ok)throw Error(body.error||'Passage retrieval unavailable');
   setPassageData(body);
  }catch(e){setPassageError(e instanceof Error?e.message:'Could not retrieve filing passages.')}
  finally{setPassageBusy(false)}
 }
 async function load(){
  const normalized=symbol.trim().toUpperCase();
  if(!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(normalized)){setError('Enter a valid stock ticker.');return}
  setPending(true);setError('');setData(null);setFilter('All');setPassageData(null);setPassageError('');
  try{
   const response=await fetch('/api/sec/filings?symbol='+encodeURIComponent(normalized),{cache:'no-store'});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'SEC filings unavailable');
   setData(json as SEC);
  }catch(e){setError(e instanceof Error?e.message:'SEC filings are unavailable')}
  finally{setPending(false)}
 }
 const filings=(data?.filings??[]).filter(f=>filter==='All'||f.form.startsWith(filter));
 return <section className="sec-intelligence">
  <div className="sec-hero"><div><div className="eyebrow">RESEARCH INTELLIGENCE / SEC EDGAR</div><h2>Read the <span className="gradient">evidence.</span></h2><p>Find official company filings, inspect structured financial facts, and open the original SEC documents. Filing metadata is not a substitute for reading the underlying disclosures.</p></div><span className="sec-provider">Official SEC · No subscription</span></div>
  <div className="sec-controls">
   <label htmlFor="sec-ticker">Company ticker</label>
   <div><input id="sec-ticker" maxLength={12} value={symbol} onChange={e=>setSymbol(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void load()}} placeholder="NVDA"/>
    <button className="primary" disabled={pending} onClick={()=>void load()}>{pending?'Retrieving filings…':'Retrieve SEC filings ↗'}</button></div>
   <p>Try NVDA, MSFT, AAPL, or another US-listed company. Requests are server-side and cached.</p>
  </div>
  {pending&&<div className="sec-loading" role="status"><div className="market-skeleton" style={{height:110}}/><div className="market-skeleton" style={{height:180}}/>Retrieving official SEC data…</div>}
  {error&&<div role="alert" className="market-alert"><strong>SEC data unavailable</strong>{error}</div>}
  {!data&&!pending&&!error&&<div className="sec-empty"><span>▤</span><h3>Start with a company's disclosures.</h3><p>Retrieved filings and facts will appear here with official source links. We won't display synthetic filing data.</p></div>}
  {data&&<>
   <div className="sec-company-banner"><div><span>SEC CIK {data.cik}</span><h3>{data.name}</h3><p>{data.symbol} · {data.filings.length} recent qualifying filings · Retrieved {new Date(data.fetchedAt).toLocaleString()}</p></div><span className="sec-trust-pill">SEC EDGAR VERIFIED SOURCE</span></div>
   <div className="sec-section-head"><h3>Reported financial facts</h3><small>Structured XBRL values matched to filing accession · Original filing linked</small></div>
   {data.facts.length?<div className="sec-facts">{data.facts.map(f=><article className="sec-fact" key={f.id}><small>{f.label}</small><strong>{humanCurrency(f.value)}</strong><span>Period ending {f.end} · {f.form}</span>{safeLink(f.url)&&<a target="_blank" rel="noreferrer" href={f.url}>Source filing ↗</a>}</article>)}</div>:<div className="sec-muted-box">No validated XBRL values matched the recent filing list. Financial facts are unavailable rather than estimated.</div>}
   <div className="sec-section-head"><h3>Recent regulatory filings</h3><small>Browse SEC submissions and open the original documents</small></div>
   <div className="sec-filters" aria-label="Filter SEC forms">{['All','10-K','10-Q','8-K'].map(value=><button key={value} className={filter===value?'active':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value}</button>)}</div>
   {filings.length?<div className="sec-filing-list">{filings.map(f=><a className="sec-filing-row" href={f.url} target="_blank" rel="noreferrer" key={f.id}><span className="sec-form-pill">{f.form}</span><span className="sec-filing-name"><strong>{f.description||f.form}</strong><small>Filed {f.filed}{f.reportDate?' · Period '+f.reportDate:''}</small></span><span className="sec-filing-open">Read filing ↗</span></a>)}</div>:<p className="sec-muted-box">No {filter} submissions in the recent SEC response.</p>}
   <div className="sec-section-head"><h3>Find evidence inside filings</h3><small>Bounded full-text retrieval · keyword ranking · original filing linked</small></div>
   <div className="sec-passage-search"><label htmlFor="sec-passage-query">Search 10-K and 10-Q content</label>
    <div><input id="sec-passage-query" value={passageQuery} maxLength={250} onChange={e=>setPassageQuery(e.target.value)}
      onKeyDown={e=>{if(e.key==='Enter')void searchPassages()}} placeholder="Ask about competition or risks..."/>
     <button className="primary" disabled={passageBusy||passageQuery.trim().length<4} onClick={()=>void searchPassages()}>{passageBusy?'Retrieving…':'Find cited passages ↗'}</button></div>
    <p>Retrieves up to two recent reports. Matching uses transparent keyword ranking—not semantic embeddings. Some large filings cannot be processed within safe limits.</p>
   </div>
   {passageBusy&&<div className="market-skeleton" style={{height:125}} role="status" aria-label="Retrieving filing passages"/>}
   {passageError&&<div className="market-alert" role="alert">{passageError}</div>}
   {passageData&&<div className="sec-passages"><h4>{passageData.passages.length} relevant passages from {passageData.attempted} attempted filings</h4>
    {passageData.passages.map((passage,i)=><article key={passage.accession+'-'+passage.start}>
     <div className="sec-passage-head"><span>{i+1}. {passage.form} · {passage.filed}</span><span>{passage.section}</span></div>
     <p>{passage.text.length>800?passage.text.slice(0,800)+'…':passage.text}</p>
     {safeLink(passage.url)&&<a href={passage.url} target="_blank" rel="noreferrer">Read original SEC filing ↗</a>}
    </article>)}
    {!passageData.passages.length&&<p>No matching document excerpts were available. Don't infer missing text from metadata.</p>}
    {passageData.warnings.length>0&&<details><summary>Retrieval notes ({passageData.warnings.length})</summary>{passageData.warnings.map((warning,i)=><p key={i}>{warning}</p>)}</details>}
   </div>}
   {onResearch&&<button className="secondary sec-research-action" onClick={()=>onResearch('Summarize the latest SEC 10-K and 10-Q filings for '+data.symbol)}>Research these SEC filings ↗</button>}
   {data.warnings.length>0&&<details className="sec-caveats"><summary>Data availability notes ({data.warnings.length})</summary>{data.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>}
   <p className="sec-disclaimer">Source: SEC EDGAR submissions and XBRL concepts. A filing date is not its financial reporting period. Revenue and net income can represent different durations; do not compare without reviewing the source filing. Passages are extracted from bounded portions of recent filing text; the result is not a complete review of all risk disclosures.</p>
  </>}
 </section>;
}
