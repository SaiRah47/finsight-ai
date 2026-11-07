import 'server-only';
import {extractFilingText} from './filing-retrieval';
import {REAL_SEC_CASES,evaluateRealSECText} from './real-sec-benchmark';
import {compareSemanticCandidates,type SemanticComparison} from './semantic-rerank';
const LIMIT=2_400_000;
export type RealRunResult={
 ticker:string;sourceUrl:string;filed:string;accession:string;retrievedAt:string;
 documentCoverage:'complete'|'partial'|'unavailable';
 bytesRead:number;expectedBytes:number|null;
 question:string;anchor:string;
 anchorFound:boolean;rankings:ReturnType<typeof evaluateRealSECText>['comparison'];
 semantic:SemanticComparison|null;
 limitations:string[];
};
export async function runRealSecBenchmark(ticker:'AAPL'|'MSFT'|'NVDA',optInSemantic:boolean):Promise<RealRunResult>{
 const caseItem=REAL_SEC_CASES.find(c=>c.ticker===ticker)!;
 const agent=process.env.SEC_USER_AGENT?.trim();
 if(!agent||!/.+\s+[^\s@]+@[^\s@]+\.[^\s@]+/.test(agent))
  throw Error('Set SEC_USER_AGENT with your application name and monitored contact email in Vercel.');
 const result:RealRunResult={
  ticker,sourceUrl:caseItem.url,filed:caseItem.filed,accession:caseItem.accession,
  retrievedAt:new Date().toISOString(),documentCoverage:'unavailable',bytesRead:0,expectedBytes:null,
  question:caseItem.question,anchor:caseItem.anchor,anchorFound:false,rankings:[],semantic:null,limitations:[]
 };
 // Only hardcoded, source-verified SEC filing URLs are fetched. No client URLs.
 let response:Response;
 try{
  response=await fetch(caseItem.url,{headers:{'User-Agent':agent,'Accept':'text/html'},next:{revalidate:86400},signal:AbortSignal.timeout(16000)});
 }catch{
  result.limitations.push('SEC filing fetch timed out or could not connect.');
  return result;
 }
 if(!response.ok){
  result.limitations.push('Official SEC archive returned HTTP '+response.status+'. Respect SEC fair-access limits.');
  return result;
 }
 const declared=Number(response.headers.get('content-length'));
 result.expectedBytes=Number.isFinite(declared)&&declared>0?declared:null;
 if(!response.body){result.limitations.push('SEC returned no readable body.');return result}
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let html='',ended=false;
 try{
  while(result.bytesRead<LIMIT){
   const {done,value}=await reader.read();
   if(done){ended=true;break}
   result.bytesRead+=value.byteLength;
   if(result.bytesRead>LIMIT){
    html+=decoder.decode(value.slice(0,Math.max(0,value.byteLength-(result.bytesRead-LIMIT))),{stream:true});
    break;
   }
   html+=decoder.decode(value,{stream:true});
  }
  html+=decoder.decode();
 }catch{result.limitations.push('SEC document stream interrupted; only available bytes were processed.')}
 finally{await reader.cancel().catch(()=>{})}
 if(!html.trim()){result.limitations.push('No usable SEC document content was downloaded.');return result}
 result.documentCoverage=ended?'complete':'partial';
 if(!ended)result.limitations.push('The filing exceeds the 2.4 MB evaluation cap; only an early partial document is inspected.');
 const evaluated=evaluateRealSECText(caseItem,html);
 result.anchorFound=evaluated.documentContainsAnchor;
 result.rankings=evaluated.comparison;
 result.limitations.push(...evaluated.limitations);
 if(optInSemantic&&result.anchorFound){
  const document=extractFilingText(html);
  result.semantic=await compareSemanticCandidates(document,caseItem.question,caseItem.anchor);
 }else if(optInSemantic)result.limitations.push('Semantic comparison skipped because the expected evidence was not extracted.');
 return result;
}
