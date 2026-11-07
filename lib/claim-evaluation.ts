/**
 * Conservative, reproducible checks for structured financial statements.
 * Citation existence and lexical coverage are screening signals, not entailment.
 * An automated checker must never certify a free-form LLM claim as true.
 */
export type CitedSource={id:string;url:string;label:string;date:string|null};
export type ClaimAudit={claim:string;citations:string[];status:'needs-review'|'unsupported'|'source-linked';reasons:string[];supportingIds:string[]};
const words=(value:string)=>new Set((value.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g)||[]).filter(w=>!['that','this','from','have','with','were','when','their','which','about','reported','company','filing','stock','data','source','more','than'].includes(w)));
const extractNumbers=(value:string)=>[...value.matchAll(/(?<![A-Za-z])(?:\$\s*)?\d[\d,]*(?:\.\d+)?\s*(?:%|billion|million|trillion|×)?/g)].map(x=>x[0].replace(/\s+/g,'').replace(/,/g,'').toLowerCase());
export function auditClaims(answer:string,sources:CitedSource[],evidence:string[]):ClaimAudit[]{
 const citations=new Set(sources.map(x=>x.id));
 const sentences=answer.split(/(?<=[.!?])\s+|\n+/).map(x=>x.trim()).filter(x=>x.length>=18).slice(0,32);
 const corpus=evidence.join(' \n ').toLowerCase();
 return sentences.map(claim=>{
  const used=[...new Set([...claim.matchAll(/\[([sS]\d+)\]/g)].map(x=>x[1].toUpperCase()))];
  const supportingIds=used.filter(x=>citations.has(x));
  const reasons:string[]=[];
  if(!supportingIds.length)reasons.push('No valid linked citation on this statement.');
  if(used.some(x=>!citations.has(x)))reasons.push('Cites unknown source IDs.');
  const numeric=extractNumbers(claim.replace(/\[S\d+\]/gi,''));
  if(numeric.length&&numeric.some(n=>!corpus.replace(/\s+/g,'').replace(/,/g,'').includes(n)))
   reasons.push('One or more numeric values were not found verbatim in retrieved evidence.');
  const claimTerms=words(claim),evidenceTerms=words(corpus);
  const covered=[...claimTerms].filter(w=>evidenceTerms.has(w)).length;
  const ratio=claimTerms.size?covered/claimTerms.size:0;
  if(ratio<0.35)reasons.push('Low lexical overlap with retrieved evidence.');
  const unsupported=!supportingIds.length||reasons.some(r=>r.includes('numeric')||r.includes('unknown')||r.includes('Low lexical'));
  return {claim,citations:used,status:unsupported?'unsupported':'needs-review',reasons:reasons.length?reasons:['Source ID exists and lexical checks passed; factual entailment still requires review.'],supportingIds};
 });
}
export function summarizeClaimAudit(rows:ClaimAudit[]){
 return {claims:rows.length,unsupported:rows.filter(x=>x.status==='unsupported').length,needsReview:rows.filter(x=>x.status==='needs-review').length,
  verdict:'Automated screening only; no free-form claim is marked factually verified.'};
}
