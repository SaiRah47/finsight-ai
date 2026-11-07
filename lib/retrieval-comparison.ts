import {makeChunks,queryTerms,retrievePassages,type FilingDocument,type FilingPassage} from './filing-retrieval.ts';

const dedupe=(items:FilingPassage[],limit:number)=>{
 const picked:FilingPassage[]=[];
 for(const item of items){
  if(picked.some(p=>Math.min(p.end,item.end)-Math.max(p.start,item.start)>200))continue;
  picked.push(item);
  if(picked.length>=limit)break;
 }
 return picked;
};
const normalize=(text:string)=>[...(text.toLowerCase().match(/[a-z0-9]+/g)||[])];
/** Transparent BM25 (k1=1.2, b=0.75), same chunks and query as production keyword ranker. */
export function retrieveBM25(document:FilingDocument,question:string,limit=4):FilingPassage[]{
 const chunks=makeChunks(document);
 const terms=queryTerms(question);
 if(!terms.length||!chunks.length)return [];
 const tokenized=chunks.map(c=>normalize(c.text));
 const lengths=tokenized.map(x=>x.length);
 const meanLength=lengths.reduce((a,b)=>a+b,0)/lengths.length||1;
 const df=new Map<string,number>();
 for(const term of terms){
  const pieces=normalize(term);
  const token=pieces.join('');
  df.set(term,tokenized.filter(tokens=>tokens.includes(token)).length);
 }
 const scored=chunks.map((c,i)=>{
  const counts=new Map<string,number>();
  for(const token of tokenized[i])counts.set(token,(counts.get(token)||0)+1);
  let score=0;const matched:string[]=[];
  for(const term of terms){
   const q=normalize(term).join(''),tf=counts.get(q)||0;
   if(!tf)continue;
   matched.push(term);
   const documentFrequency=df.get(term)||0;
   const idf=Math.log(1+(chunks.length-documentFrequency+0.5)/(documentFrequency+0.5));
   score+=idf*tf*(1.2+1)/(tf+1.2*(1-0.75+0.75*lengths[i]/meanLength));
  }
  return {...c,score:Number(score.toFixed(4)),matchedTerms:matched};
 }).filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.start-b.start);
 return dedupe(scored,Math.max(1,Math.min(limit,6)));
}
export type RankerComparison={method:'weighted-lexical'|'BM25';retrieved:number;expectedAnchorFoundAt:number|null;topResults:{section:string;score:number;matchedTerms:string[]}[]};
export function compareRankers(document:FilingDocument,question:string,anchor:string,limit=3):RankerComparison[]{
 return [
  ['weighted-lexical',retrievePassages(document,question,limit)],
  ['BM25',retrieveBM25(document,question,limit)]
 ].map(([method,raw])=>{
  const passages=raw as FilingPassage[];
  const expectedAnchorFoundAt=passages.findIndex(p=>p.text.toLowerCase().includes(anchor.toLowerCase()));
  return {method:method as RankerComparison['method'],retrieved:passages.length,
   expectedAnchorFoundAt:expectedAnchorFoundAt<0?null:expectedAnchorFoundAt+1,
   topResults:passages.map(p=>({section:p.section,score:p.score,matchedTerms:p.matchedTerms}))};
 });
}
