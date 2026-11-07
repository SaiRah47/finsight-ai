import 'server-only';
import {getCompanyFilings} from './sec';
import {downloadSecDocument} from './sec-download';
import {extractFilingText,retrievePassages,type FilingPassage} from './filing-retrieval';

export type SecRetrievedPassage=FilingPassage&{
 symbol:string;form:string;filed:string;accession:string;url:string;filingDescription:string;
};
export type FilingCoverage={
 accession:string;form:string;filed:string;complete:boolean;bytesRead:number;maxBytes:number;
 textCharacters:number;sections:number;extractionTruncated:boolean;passagesFound:number;fetchMs:number;
};
export type SecPassageResponse={
 symbol:string;question:string;passages:SecRetrievedPassage[];attempted:number;warnings:string[];
 retrievalMethod:'bounded-text-keyword-v2';fetchedAt:string;
 coverage:FilingCoverage[];durationMs:number;
};
export async function getRelevantSecPassages(symbol:string,question:string):Promise<SecPassageResponse>{
 const started=Date.now();
 const data=await getCompanyFilings(symbol);
 const target=data.filings.filter(f=>f.form==='10-K'||f.form==='10-Q').slice(0,2);
 const warnings=[...data.warnings];
 if(!target.length)warnings.push('No recent annual or quarterly report available for document retrieval.');
 const passages:SecRetrievedPassage[]=[];
 const coverage:FilingCoverage[]=[];
 for(const filing of target){
  try{
   const downloaded=await downloadSecDocument(filing.url);
   const document=extractFilingText(downloaded.html);
   const matching=retrievePassages(document,question,3);
   coverage.push({accession:filing.accession,form:filing.form,filed:filing.filed,
    complete:downloaded.complete&&!document.truncated,
    bytesRead:downloaded.bytes,maxBytes:downloaded.maxBytes,
    textCharacters:document.text.length,sections:document.sections.length,
    extractionTruncated:document.truncated,passagesFound:matching.length,fetchMs:downloaded.durationMs});
   if(!downloaded.complete)warnings.push(filing.form+' exceeds the bounded download limit; only partial document content was examined.');
   if(document.truncated)warnings.push(filing.form+' text extraction reached its character cap. Results may not cover the full filing.');
   if(!matching.length)warnings.push('No relevant passage found in the extracted portion of '+filing.form+' filed '+filing.filed+'.');
   for(const p of matching)passages.push({...p,symbol:data.symbol,form:filing.form,filed:filing.filed,accession:filing.accession,url:filing.url,filingDescription:filing.description});
  }catch(error){
   warnings.push(filing.form+' document extraction unavailable: '+(error instanceof Error?error.message:'unknown error'));
  }
 }
 passages.sort((a,b)=>b.score-a.score||b.filed.localeCompare(a.filed));
 return {symbol:data.symbol,question,passages:passages.slice(0,5),attempted:target.length,
  warnings,coverage,retrievalMethod:'bounded-text-keyword-v2',fetchedAt:new Date().toISOString(),
  durationMs:Date.now()-started};
}
