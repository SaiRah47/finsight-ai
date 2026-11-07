'use client';
import {useState} from 'react';
import {REVIEW_PROMPTS} from '@/lib/review-queue';
type ReviewStats={reviewed:number;supported:number;unsupported:number;uncertain:number;judgedRelevantShare:number|null;topOneJudgedRelevantShare:number|null;decided:number;topOneJudged:number};
type NodeSummary={node:string;samples:number;p50Ms:number|null;p95Ms:number|null;failures:number};
type Dashboard={runs:number;traces:number;sourceBearing:number;sourceCoverage:number|null;statuses:Record<string,number>;perNode:NodeSummary[];failures:Record<string,number>;reviews:{count:number;supported:number;unsupported:number;uncertain:number};limitations:string[];generatedAt:string};
export default function ResearchQualityDashboard(){
 const [data,setData]=useState<Dashboard|null>(null),[reviewStats,setReviewStats]=useState<ReviewStats|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [issuer,setIssuer]=useState<'NVDA'|'MSFT'|'AAPL'>('NVDA'),[copied,setCopied]=useState('');
 async function load(){
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/ops/summary',{cache:'no-store'}),json=await response.json();
   if(!response.ok)throw Error(json.error||'Diagnostics unavailable');
   setData(json);
   const reviewed=await fetch('/api/evaluation/reviews',{cache:'no-store'});
   if(reviewed.ok){const labeled=await reviewed.json();setReviewStats(labeled.summary?.retrieval||null)}else setReviewStats(null);
  }catch(e){setError(e instanceof Error?e.message:'Diagnostics unavailable')}
  finally{setLoading(false)}
 }
 return <section className="quality-screen">
  <div className="quality-heading"><div><div className="eyebrow">ATLAS RESEARCH ENGINEERING / PHASE 5</div><h2>Quality &amp; <span className="gradient">observability.</span></h2>
   <p>Private, evidence-based diagnostics from your recent saved execution traces and human annotations. No fabricated KPIs.</p></div>
   <button className="primary" onClick={()=>void load()} disabled={loading}>{loading?'Loading…':data?'Refresh quality metrics ↻':'Load quality metrics ↗'}</button>
  </div>
  {error&&<div className="market-alert" role="alert">{error}</div>}
  {!data&&!loading&&!error&&<div className="sec-empty"><span>◈</span><h3>Inspect measured execution quality.</h3><p>Load the recent trace-derived latency samples, evidence-source coverage, and your reviewed retrieval and claim judgments.</p></div>}
  {data&&<>
   <div className="quality-metrics">
    <div><small>Research runs</small><strong>{data.runs}</strong><span>Latest 100</span></div>
    <div><small>Saved traces</small><strong>{data.traces}</strong><span>Recent runs with events</span></div>
    <div><small>Evidence-bearing traces</small><strong>{data.sourceCoverage===null?'—':Math.round(data.sourceCoverage*100)+'%'}</strong><span>{data.sourceBearing} / {data.traces}</span></div>
    <div><small>Human reviews</small><strong>{data.reviews.count}</strong><span>Target: 30–50 genuine labels</span></div>
   </div>
   <div className="quality-panel"><div className="sectiontitle"><h3>Agent timing and reliability</h3><span className="pill">Recent saved traces</span></div>
    {data.perNode.length?<div className="quality-node-list">{data.perNode.map(node=><div key={node.node} className="quality-node">
     <strong>{node.node}</strong><span>n={node.samples}</span><span>p50 {node.p50Ms??'—'} ms</span><span>p95 {node.p95Ms??'—'} ms</span><span>Failures: {node.failures}</span>
    </div>)}</div>:<p className="muted">No completed node timing observations have been saved yet. Run research in Execution Studio first.</p>}
   </div>
   <div className="quality-panels"><div className="quality-panel"><h3>Review labeling</h3>
    <p>Supported: {data.reviews.supported} · Unsupported: {data.reviews.unsupported} · Uncertain: {data.reviews.uncertain}</p>
    <p className="muted">These are manually submitted judgments, not model-derived accuracy metrics or independently adjudicated labels.</p>
   </div><div className="quality-panel"><h3>Recorded failures</h3>
    {Object.keys(data.failures).length?Object.entries(data.failures).map(([node,count])=><p key={node}>{node}: {count}</p>):<p className="muted">No failure events among the sampled saved traces. This does not guarantee the provider was always available.</p>}
   </div></div>
   <details className="sec-caveats"><summary>Sampling and reliability limitations</summary>{data.limitations.map((line,i)=><p key={i}>{line}</p>)}</details>
  </>}
  <div className="quality-panel"><h3>Human review candidate queue</h3>
   <p>36 unlabeled candidate questions for NVIDIA, Microsoft, and Apple. These are prompts, not pre-verified SEC facts or completed annotations. Use the SEC filings tab to retrieve and judge evidence; counts appear above after saving.</p>
   <div className="benchmark-issuers">{(['NVDA','MSFT','AAPL'] as const).map(x=><button key={x} type="button" aria-pressed={issuer===x} className={issuer===x?'active':''} onClick={()=>setIssuer(x)}>{x}</button>)}</div>
   <div className="review-queue">{REVIEW_PROMPTS.filter(q=>q.symbol===issuer).map(prompt=><div key={prompt.id}><span>{prompt.id}{prompt.intent==='abstention-probe'?' · Absence probe':''}</span><p>{prompt.question}</p><button type="button" onClick={()=>{void navigator.clipboard.writeText(prompt.question).then(()=>setCopied(prompt.id)).catch(()=>setCopied(''))}}>{copied===prompt.id?'Copied':'Copy question'}</button></div>)}</div>
  </div>
  <div className="quality-panel"><h3>Evaluation program</h3>
   <p>Our 11 synthetic SEC fixtures run in GitHub Actions. A separate source-verified three-company filing lab compares weighted lexical retrieval and BM25. Human-reviewed cases accumulate only when you explicitly label actual retrieved passages; no labels are automatically invented.</p>
   <p className="muted">Open SEC filings to review passages. Use the Execution Studio briefing to review generated claims. The private Supabase evaluation table must be created once before labels can be saved.</p>
   <a href="https://github.com/SaiRah47/finsight-ai/blob/main/docs/PHASE_5.md" target="_blank" rel="noreferrer">Phase 5 methodology and setup ↗</a>
  </div>
 </section>;
}
