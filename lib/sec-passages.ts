import 'server-only';
import {getCompanyFilings,SecError} from './sec';
import {extractFilingText,retrievePassages,type FilingPassage} from './filing-retrieval';

export type SecRetrievedPassage=FilingPassage&{
 symbol:string;form:string;filed:string;accession:string;url:string;filingDescription:string;
};
export type SecPassageResponse={symbol:string;question:string;passages:SecRetrievedPassage[];attempted:number;warnings:string[];retrievalMethod:'bounded-text-keyword-v1';fetchedAt:string};
const MAX_BYTES=2_400_000;
async function downloadFiling(url:string):Promise<string>{
 // Server-only restricted to the exact official SEC archive filing-document shape.
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||parsed.hostname!=='www.sec.gov'||!/^\/Archives\/edgar\/data\/\d+\/\d{18}\/[a-zA-Z0-9_.-]+$/.test(parsed.pathname))
  throw new SecError('Unrecognized SEC filing-document URL.',400);
 const agent=process.env.SEC_USER_AGENT?.trim();
 if(!agent||!/.+\s+[^\s@]+@[^\s@]+\.[^\s@]+/.test(agent))throw new SecError('Configure SEC_USER_AGENT with your application name and real contact email in Vercel.',503);
 let response:Response;
 try{response=await fetch(url,{headers:{'User-Agent':agent,'Accept':'text/html,text/plain;q=0.9'},next:{revalidate:21600},signal:AbortSignal.timeout(14000)})}
 catch{throw new SecError('SEC filing document could not be reached.',502)}
 if(response.status===403||response.status===429)throw new SecError('SEC restricted filing retrieval. Review fair-access policy or retry later.',response.status===429?429:502);
 if(!response.ok)throw new SecError('SEC document retrieval returned HTTP '+response.status,response.status===404?404:502);
 const contentType=response.headers.get('content-type')||'';
 if(contentType&&!/html|text|octet-stream/i.test(contentType))throw new SecError('SEC returned an unsupported document format.',422);
 const declared=Number(response.headers.get('content-length'));
 if(declared>MAX_BYTES)throw new SecError('SEC filing is larger than this prototype’s safe extraction limit.',413);
 if(!response.body)throw new SecError('SEC filing response contained no document body.',502);
 const reader=response.body.getReader();
 const decoder=new TextDecoder();
 let total=0,plain='';
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>MAX_BYTES)throw new SecError('SEC filing exceeded this prototype’s safe extraction limit.',413);
   plain+=decoder.decode(value,{stream:true});
  }
  return plain+decoder.decode();
 }finally{await reader.cancel().catch(()=>{})}
}
export async function getRelevantSecPassages(symbol:string,question:string):Promise<SecPassageResponse>{
 const data=await getCompanyFilings(symbol);
 const target=data.filings.filter(f=>f.form==='10-K'||f.form==='10-Q').slice(0,2);
 const warnings=[...data.warnings];
 if(!target.length)warnings.push('No recent annual or quarterly report available for document retrieval.');
 const passages:SecRetrievedPassage[]=[];
 for(const filing of target){
  try{
   const html=await downloadFiling(filing.url);
   const document=extractFilingText(html);
   const matching=retrievePassages(document,question,3);
   if(document.truncated)warnings.push(filing.form+' was truncated to protect processing limits. Retrieved passages may be incomplete.');
   if(!matching.length)warnings.push('No relevant passage found in '+filing.form+' filed '+filing.filed+'.');
   for(const p of matching){
    passages.push({...p,symbol:data.symbol,form:filing.form,filed:filing.filed,accession:filing.accession,url:filing.url,filingDescription:filing.description});
   }
  }catch(error){
   warnings.push(filing.form+' document extraction unavailable: '+(error instanceof Error?error.message:'unknown error'));
  }
 }
 passages.sort((a,b)=>b.score-a.score||b.filed.localeCompare(a.filed));
 return {symbol:data.symbol,question,passages:passages.slice(0,5),attempted:target.length,
  warnings,retrievalMethod:'bounded-text-keyword-v1',fetchedAt:new Date().toISOString()};
}
