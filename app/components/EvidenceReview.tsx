'use client';
import {useState} from 'react';
type Verdict='supported'|'unsupported'|'uncertain';
export default function EvidenceReview({kind,question,excerpt,symbol,sourceUrl,accession,rank}:{
 kind:'retrieval'|'claim';question:string;excerpt:string;symbol?:string|null;
 sourceUrl?:string|null;accession?:string|null;rank?:number|null;
}){
 const [saved,setSaved]=useState<Verdict|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(verdict:Verdict){
  if(busy||saved)return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/evaluation/reviews',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({kind,verdict,question:question.slice(0,500),excerpt:excerpt.slice(0,1600),
     symbol:symbol||null,source_url:sourceUrl||null,accession:accession||null,rank:rank||null})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Review could not be saved');
   setSaved(verdict);
  }catch(e){setError(e instanceof Error?e.message:'Unable to save reviewer judgment')}
  finally{setBusy(false)}
 }
 return <div className="evidence-review">
  <span>{kind==='claim'?'Is this claim supported by the linked source?':'Does this passage directly answer the research question?'}</span>
  {saved?<strong className="evidence-reviewed">Recorded: {saved.replace('-',' ')}</strong>:<div className="evidence-review-actions">
   {(['supported','unsupported','uncertain'] as const).map(v=><button key={v} disabled={busy} type="button" onClick={()=>void save(v)}>{v==='supported'?'Relevant / supported':v==='unsupported'?'Not relevant / unsupported':'Uncertain'}</button>)}
  </div>}
  {error&&<p role="alert">{error}</p>}
 </div>;
}
