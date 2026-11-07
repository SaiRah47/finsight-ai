import {authorizedOwner} from '@/lib/supabase/server';
import {getCompanyFilings} from '@/lib/sec';
export const runtime='nodejs';
export const maxDuration=60;
/** Owner-triggered SEC discovery for at most three saved watchlist symbols. No scheduled polling. */
export async function GET(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner login required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const {data,error}=await owner.db.from('watchlist_symbols').select('symbol').eq('user_id',owner.user.id).order('created_at',{ascending:false}).limit(3);
 if(error)return Response.json({error:'Cannot read saved watchlist.'},{status:503});
 const symbols=(data||[]).map(row=>String(row.symbol));
 const discovered: {symbol:string;name:string;filings:{accession:string;form:string;filed:string;url:string;recent:boolean}[];error:string|null}[]=[];
 const cutoff=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
 for(const symbol of symbols){
  try{
   const company=await getCompanyFilings(symbol,{includeFacts:false});
   const filings=company.filings.slice(0,4).map(f=>({accession:f.accession,form:f.form,filed:f.filed,url:f.url,recent:f.filed>=cutoff}));
   discovered.push({symbol,name:company.name,filings,error:null});
  }catch(error){discovered.push({symbol,name:symbol,filings:[],error:error instanceof Error?error.message:'SEC filings unavailable'})}
 }
 return Response.json({symbolsChecked:symbols.length,cutoff,discovered,checkedAt:new Date().toISOString(),
  caveat:'On-demand check of the three newest watchlist symbols, comparing filing dates to the last seven calendar days. Not a new-since-last-seen notification, continuous monitor, or exhaustive historical filings search.'},
  {headers:{'Cache-Control':'no-store'}});
}
