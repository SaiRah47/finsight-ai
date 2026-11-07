import 'server-only';
import {validSymbol} from './market';

import type {SecCompany,SecFiling,SecFact} from './sec-types';
import {parseTickerMap,parseRecentFilings,parseConcept} from './sec-parser';
export class SecError extends Error{constructor(message:string,public status=502){super(message)}}



const SEC_HOST='https://data.sec.gov';
const SEC_WWW='https://www.sec.gov';


const safeAccession=(value:string)=>/^\d{10}-\d{2}-\d{6}$/.test(value);
const isDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);

function userAgent():string{
 const value=process.env.SEC_USER_AGENT?.trim();
 if(!value||!/.+\s+[^\s@]+@[^\s@]+\.[^\s@]+/.test(value))
  throw new SecError('SEC access needs SEC_USER_AGENT in Vercel (application name and a real contact email), then redeploy.',503);
 return value;
}
async function secJson(url:string,ttl:number):Promise<unknown>{
 // Only these known SEC hosts; never proxy arbitrary user URLs.
 const parsed=new URL(url);
 if(!([new URL(SEC_HOST).hostname,new URL(SEC_WWW).hostname].includes(parsed.hostname))||parsed.protocol!=='https:')
  throw new SecError('Invalid SEC API endpoint',400);
 let response:Response;
 try{response=await fetch(url,{headers:{'User-Agent':userAgent(),'Accept':'application/json'},next:{revalidate:ttl},signal:AbortSignal.timeout(12000)})}
 catch{throw new SecError('Could not reach SEC EDGAR. Try again later.',502)}
 if(response.status===429)throw new SecError('SEC EDGAR is rate-limiting this application. Try again later.',429);
 if(response.status===403)throw new SecError('SEC EDGAR denied access. Verify SEC_USER_AGENT and fair-access rules.',502);
 if(!response.ok)throw new SecError('SEC EDGAR returned HTTP '+response.status,response.status===404?404:502);
 try{return await response.json()}catch{throw new SecError('SEC EDGAR returned an invalid JSON response.')}
}
export async function getCompanyFilings(symbol:string):Promise<SecCompany>{
 const normalized=symbol.trim().toUpperCase();
 if(!validSymbol(normalized))throw new SecError('Invalid stock symbol.',400);
 // Each company's SEC CIK comes from the periodically updated official ticker map.
 const tickerMap=await secJson(SEC_WWW+'/files/company_tickers.json',86400);
 const issuer=parseTickerMap(tickerMap,normalized);
 if(!issuer)throw new SecError('No SEC CIK mapping was found for '+normalized+'. Some ETFs or non-US issuers are not supported.',404);
 const cik=String(issuer.cik_str).padStart(10,'0');
 const sub=await secJson(`${SEC_HOST}/submissions/CIK${cik}.json`,1800);
 const filings=parseRecentFilings(sub,issuer.cik_str,12);
 const warnings:string[]=[];
 if(!filings.length)warnings.push('No recent 10-K, 10-Q, or 8-K was available in the SEC submissions summary.');
 // Pull two carefully scoped XBRL concept endpoints rather than downloading enormous companyfacts payloads.
 // Filing metadata remains available even when facts are unavailable.
 const facts:SecFact[]=[];
 if(filings.some(f=>f.form==='10-K'||f.form==='10-Q')){
  for(const [tag,path] of [
   ['RevenueFromContractWithCustomerExcludingAssessedTax','RevenueFromContractWithCustomerExcludingAssessedTax'],
   ['NetIncomeLoss','NetIncomeLoss']
  ] as const){
   try{
    const json=await secJson(`${SEC_HOST}/api/xbrl/companyconcept/CIK${cik}/us-gaap/${path}.json`,21600);
    const fact=parseConcept(json,tag,filings);
    if(fact)facts.push(fact);
    else warnings.push('No matched '+tag+' XBRL fact for the displayed recent filings.');
   }catch(e){warnings.push('SEC XBRL '+tag+' unavailable: '+(e instanceof Error?e.message:'provider error'))}
  }
 }
 return {symbol:normalized,name:issuer.title,cik,filings,facts,source:'SEC EDGAR',fetchedAt:new Date().toISOString(),warnings};
}
