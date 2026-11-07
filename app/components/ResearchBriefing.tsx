'use client';
import EvidenceReview from './EvidenceReview';
import type {ResearchReport} from '@/lib/research-report';
const safe=(url:string)=>{try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='www.sec.gov'||u.hostname==='twelvedata.com')}catch{return false}};
export default function ResearchBriefing({report}:{report:ResearchReport}){
 return <article className="research-briefing">
  <div className="research-briefing-top"><div><small>FINSIGHT ATLAS · RESEARCH BRIEF / V1</small><h2>{report.headline}</h2><p>{report.question}</p></div><span className="pill">{report.mode==='ai-assisted'?'AI-assisted · inspect citations':'Evidence-only · deterministic'}</span></div>
  <div className="research-briefing-meta"><span>Route: {report.route}</span><span>Observation: {report.asOf||'Not available'}</span><span>Sources: {report.sources.length}</span><span>{new Date(report.generatedAt).toLocaleString()}</span></div>
  <div className="research-report-sections">{report.sections.map(section=><section key={section.heading} className="research-brief-section">
   <h3>{section.heading}</h3>
   <div className="research-observations">{section.observations.map((v,i)=><p key={i}>{v}</p>)}</div>
  </section>)}</div>
  {report.audit.length>0&&<div className="research-claim-review"><h3>Claim-level screening</h3><p>Automated checks can flag missing citations, unsupported numbers, and low evidence overlap. They cannot establish whether prose is true. Review flagged claims against original documents.</p>
   <div className="research-claim-stats"><span>{report.auditSummary.claims} screened</span><span>{report.auditSummary.unsupported} flagged</span><span>{report.auditSummary.needsReview} require review</span></div>
   {report.audit.map((item,i)=><div className="research-claim" key={i}><p>{item.claim}</p><small>{item.status} · {item.reasons.join(' ')}</small>
    <EvidenceReview kind="claim" question={report.question} excerpt={item.claim} symbol={report.symbol} sourceUrl={report.sources.find(s=>item.supportingIds.includes(s.id))?.url||null}/>
   </div>)}
  </div>}
  <section className="research-brief-section"><h3>Primary evidence sources</h3>
   {report.sources.length?<div className="research-citation-list">{report.sources.filter(s=>safe(s.url)).map(s=><a key={s.id} href={s.url} target="_blank" rel="noreferrer"><strong>[{s.id}] {s.label}</strong><span>{s.date||'Date not provided'} ↗</span></a>)}</div>:<p className="muted">No verified external source was available for this request.</p>}
  </section>
  <details className="research-boundaries"><summary>Assumptions and limitations</summary>{report.caveats.map((c,i)=><p key={i}>{c}</p>)}</details>
 </article>;
}
