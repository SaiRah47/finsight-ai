import 'server-only';
import {makeChunks,type FilingDocument,type FilingPassage} from './filing-retrieval';
import {retrieveBM25} from './retrieval-comparison';

export type SemanticComparison={
 status:'evaluated'|'not-configured'|'unavailable';
 model:string|null;candidateCount:number;
 results:{section:string;score:number;start:number;end:number;matchedTerms:string[]}[];
 anchorRank:number|null;warning:string;
};
function dot(a:number[],b:number[]):number{
 let sum=0,aa=0,bb=0;
 for(let i=0;i<Math.min(a.length,b.length);i++){sum+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}
 return sum/(Math.sqrt(aa)*Math.sqrt(bb)||1);
}
/**
 * Explicit opt-in OpenAI embedding comparison over a bounded BM25 candidate set.
 * This is NOT end-to-end semantic retrieval over the complete SEC document.
 */
export async function compareSemanticCandidates(doc:FilingDocument,question:string,anchor:string):Promise<SemanticComparison>{
 const key=process.env.FINSIGHT_OPENAI_API_KEY;
 if(!key)return {status:'not-configured',model:null,candidateCount:0,results:[],anchorRank:null,
  warning:'Optional embedding comparison is disabled. FINSIGHT_OPENAI_API_KEY is not configured.'};
 // Candidate union: BM25 top 14 plus a bounded number of uniform chunks.
 // Restrict to 20 short text windows to bound cost and limit untrusted SEC text sent externally.
 const chunks=makeChunks(doc);
 const selected=new Map<number,FilingPassage>();
 for(const p of retrieveBM25(doc,question,14))selected.set(p.start,p);
 if(chunks.length){
  const stride=Math.max(1,Math.floor(chunks.length/6));
  for(let i=0;i<chunks.length&&selected.size<20;i+=stride)selected.set(chunks[i].start,chunks[i]);
 }
 const candidates=[...selected.values()].slice(0,20);
 if(!candidates.length)return {status:'unavailable',model:null,candidateCount:0,results:[],anchorRank:null,warning:'No candidate passages.'};
 const model='text-embedding-3-small';
 try{
  const response=await fetch('https://api.openai.com/v1/embeddings',{
   method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({model,input:[question.slice(0,250),...candidates.map(c=>c.text.slice(0,1000))]}),
   signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)return {status:'unavailable',model,candidateCount:candidates.length,results:[],anchorRank:null,
   warning:'Embedding request unavailable (HTTP '+response.status+'). No semantic result was inferred.'};
  const raw=await response.json() as {data?:Array<{index:number;embedding:number[]}>};
  const ordered=(raw.data||[]).sort((a,b)=>a.index-b.index);
  if(ordered.length!==candidates.length+1||ordered.some((r,i)=>r.index!==i||!Array.isArray(r.embedding)))
   throw Error('Embedding response shape mismatch');
  const vector=ordered[0].embedding;
  const ranked=candidates.map((c,i)=>({...c,score:dot(vector,ordered[i+1].embedding)}))
   .sort((a,b)=>b.score-a.score||a.start-b.start).slice(0,3);
  const pos=ranked.findIndex(p=>p.text.toLowerCase().includes(anchor.toLowerCase()));
  return {status:'evaluated',model,candidateCount:candidates.length,
   results:ranked.map(p=>({section:p.section,score:Number(p.score.toFixed(4)),start:p.start,end:p.end,matchedTerms:p.matchedTerms})),
   anchorRank:pos<0?null:pos+1,
   warning:'Semantic candidate reranking only (up to 20 chunks), not a full-document vector search; requires paid API usage.'};
 }catch{return {status:'unavailable',model,candidateCount:candidates.length,results:[],anchorRank:null,
  warning:'Embedding comparison failed. No semantic benchmark score was inferred.'}}
}
