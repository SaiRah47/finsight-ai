'use client';
import {useState} from 'react';
type Ranking={method:'weighted-lexical'|'BM25';retrieved:number;expectedAnchorFoundAt:number|null;topResults:{section:string;score:number;matchedTerms:string[]}[]};
type Semantic={status:string;model:string|null;candidateCount:number;anchorRank:number|null;warning:string};
type Result={ticker:string;sourceUrl:string;filed:string;accession:string;retrievedAt:string;documentCoverage:string;
 bytesRead:number;expectedBytes:number|null;question:string;anchor:string;anchorFound:boolean;rankings:Ranking[];semantic:Semantic|null;limitations:string[]};
export default function RetrievalBenchmark(){
 const [ticker,setTicker]=useState<'NVDA'|'MSFT'|'AAPL'>('NVDA');
 const [semantic,setSemantic]=useState(false),[busy,setBusy]=useState(false);
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState('');
 async function evaluate(){
  if(busy)return;
  setBusy(true);setError('');setResult(null);
  try{
   const res=await fetch('/api/evaluation/real-sec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker,semantic}),cache:'no-store'});
   const json=await res.json();
   if(!res.ok)throw Error(json.error||'Evaluation unavailable');
   setResult(json);
  }catch(e){setError(e instanceof Error?e.message:'SEC evaluation unavailable')}
  finally{setBusy(false)}
 }
 const measured=result?.rankings||[];
 return <div className="real-sec-benchmark">
  <div className="sec-section-head"><h3>Real SEC retrieval lab</h3><small>Fixed filing anchors · experimental comparison</small></div>
  <p className="benchmark-intro">Evaluate the same official SEC document with our lexical ranker and BM25. Optionally rerank up to 20 candidates using paid API embeddings. This is a small diagnostic set, not a claim of production accuracy.</p>
  <div className="benchmark-controls">
   <div role="group" aria-label="SEC benchmark issuer" className="benchmark-issuers">
    {(['NVDA','MSFT','AAPL'] as const).map(v=><button type="button" key={v} className={ticker===v?'active':''} aria-pressed={ticker===v} disabled={busy} onClick={()=>{setTicker(v);setResult(null)}}>{v}</button>)}
   </div>
   <label className="benchmark-optin"><input type="checkbox" checked={semantic} disabled={busy} onChange={e=>setSemantic(e.target.checked)}/> Include optional embedding reranker (may incur API charges)</label>
   <button className="primary" type="button" disabled={busy} onClick={()=>void evaluate()}>{busy?'Evaluating SEC filing…':'Run filing benchmark ↗'}</button>
   <small>One fixed 10-K is retrieved per run. Microsoft filings can exceed our bounded extraction limit. Partial coverage is disclosed explicitly.</small>
  </div>
  {error&&<div role="alert" className="market-alert">{error}</div>}
  {result&&<div className="benchmark-result">
   <div className="benchmark-source"><strong>{result.ticker} · SEC 10-K · {result.filed}</strong><a href={result.sourceUrl} target="_blank" rel="noreferrer">Read official source ↗</a></div>
   <div className="benchmark-question"><small>Human-selected evaluation question</small><strong>{result.question}</strong><span>Evidence anchor: “{result.anchor}”</span></div>
   <div className="benchmark-coverage"><span>Document coverage: <strong>{result.documentCoverage}</strong></span><span>{Math.round(result.bytesRead/1024).toLocaleString()} KB read{result.expectedBytes?' of '+Math.round(result.expectedBytes/1024).toLocaleString()+' KB':''}</span><span>Expected anchor: <strong>{result.anchorFound?'Found':'Not extracted'}</strong></span></div>
   {measured.length>0&&<div className="benchmark-rankers">
    {measured.map(r=><article key={r.method}><small>{r.method==='BM25'?'BM25 baseline':'Current weighted keyword'}</small><strong>{r.expectedAnchorFoundAt===null?'Not found in top 3':'Found at rank '+r.expectedAnchorFoundAt}</strong><span>{r.retrieved} retrieved · {r.topResults[0]?.section||'No matches'}</span></article>)}
   </div>}
   {result.semantic&&<div className="benchmark-semantic"><strong>Optional embedding comparison</strong><span>{result.semantic.status==='evaluated'?'Anchor rank: '+(result.semantic.anchorRank??'not in top 3'):'Not evaluated'}</span><small>{result.semantic.warning}</small></div>}
   {result.limitations.length>0&&<details className="sec-caveats" open={result.documentCoverage!=='complete'||!result.anchorFound}><summary>Coverage and interpretation notes ({result.limitations.length})</summary>{result.limitations.map((s,i)=><p key={i}>{s}</p>)}</details>}
   <p className="benchmark-disclaimer">A matching phrase in a top-ranked passage is an extraction-and-ranking diagnostic only. It does not establish a valid research answer or that the issuer's whole filing has been reviewed.</p>
  </div>}
 </div>;
}
