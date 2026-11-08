import 'server-only';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {getHistory,getQuote,validSymbol,type MarketQuote,type HistoricalSeries} from './market';
import {getCompanyFilings} from './sec';
import {inspectHistory,type HistoryQuality} from './market-quality';
import {observationFreshness} from './arena-operations';

export type FeedState='available'|'unavailable';
export type SourceStatus={source:'Twelve Data'|'SEC EDGAR';dataset:'quote'|'history'|'fundamentals';state:FeedState;observedAt:string|null;retrievedAt:string|null;warning:string|null};
export type Intelligence={
 symbol:string;generatedAt:string;simulationOnly:true;
 quote:MarketQuote|null;history:HistoricalSeries|null;
 fundamentals:{name:string;cik:string;facts:unknown[];filings:unknown[];fetchedAt:string}|null;
 quality:HistoryQuality|null;sources:SourceStatus[];actionableEvidence:boolean;
};
function message(e:unknown){return e instanceof Error?e.message.slice(0,180):'Provider unavailable'}
function status(source:SourceStatus['source'],dataset:SourceStatus['dataset'],state:FeedState,observedAt:string|null,retrievedAt:string|null,warning:string|null):SourceStatus{
 return {source,dataset,state,observedAt,retrievedAt,warning};
}
/** Partial provider outages never substitute fabricated prices or SEC facts. */
export async function getMarketIntelligence(symbol:string,includeFundamentals=false):Promise<Intelligence>{
 if(!validSymbol(symbol))throw Error('Invalid market symbol');
 const [q,h,f]=await Promise.allSettled([
  getQuote(symbol),getHistory(symbol,'1Y'),
  includeFundamentals?getCompanyFilings(symbol,{includeFacts:true}):Promise.resolve(null)
 ]);
 const quote=q.status==='fulfilled'?q.value:null;
 const history=h.status==='fulfilled'?h.value:null;
 const sec=f.status==='fulfilled'?f.value:null;
 const quality=history?inspectHistory(history.bars):null;
 const sources:SourceStatus[]=[
  status('Twelve Data','quote',quote?'available':'unavailable',quote?.asOf??null,quote?.fetchedAt??null,q.status==='rejected'?message(q.reason):null),
  status('Twelve Data','history',history?'available':'unavailable',quality?.lastDate??null,history?.fetchedAt??null,
   h.status==='rejected'?message(h.reason):quality&&!quality.acceptable?quality.issues.map(x=>x.message).join('; '):null)
 ];
 if(includeFundamentals)sources.push(status('SEC EDGAR','fundamentals',sec?'available':'unavailable',
  sec?.filings?.[0]?.filed??null,sec?.fetchedAt??null,f.status==='rejected'?message(f.reason):sec?.warnings?.join('; ')??null));
 // Missing, stale, or non-USD market quotes must never form an executable signal.
 const asOf=quote?.asOf??null;
 const date=asOf?.match(/^\d{4}-\d{2}-\d{2}/)?.[0]??null;
 const current=quality?.lastDate??null;
 const actionableEvidence=Boolean(quote&&quote.currency==='USD'&&quote.price>0&&observationFreshness(quote.asOf).valid&&quality?.acceptable&&date&&current&&
  Math.abs((Date.parse(date+'T00:00:00Z')-Date.parse(current+'T00:00:00Z'))/86400000)<=5);
 return {symbol,generatedAt:new Date().toISOString(),simulationOnly:true,quote,history,
  fundamentals:sec?{name:sec.name,cik:sec.cik,facts:sec.facts,filings:sec.filings,fetchedAt:sec.fetchedAt}:null,
  quality,sources,actionableEvidence};
}
function dbAdmin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Historical archive storage is not configured.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
/**
 * Versioned point-in-time archive; the original data are never overwritten.
 * Identical observations are deduplicated per user/symbol/dataset checksum.
 * Requests are owner-authenticated at the route boundary.
 */
export async function archiveDailyHistory(owner:string,symbol:string){
 if(!validSymbol(symbol))throw Error('Invalid market symbol');
 const history=await getHistory(symbol,'1Y');
 const quality=inspectHistory(history.bars);
 if(quality.issues.some(x=>x.severity==='error'))throw Error('Provider history failed OHLCV validation; archive not written.');
 const payload={symbol:history.symbol,interval:history.interval,period:history.period,provider:history.provider,
  currency:history.currency,bars:history.bars};
 const checksum=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 const db=dbAdmin();
 const row={user_id:owner,symbol,provider:history.provider,interval:history.interval,period:history.period,
  first_date:quality.firstDate,last_date:quality.lastDate,observation_count:history.bars.length,
  dataset_sha256:checksum,quality,payload,source_fetched_at:history.fetchedAt};
 const {data,error}=await db.from('market_dataset_snapshots').upsert(row,{
  onConflict:'user_id,symbol,dataset_sha256',ignoreDuplicates:true
 }).select('id,symbol,provider,interval,period,first_date,last_date,observation_count,dataset_sha256,quality,captured_at').maybeSingle();
 if(error)throw Error('Historical archive unavailable: '+error.message.slice(0,120));
 if(data)return data;
 const existing=await db.from('market_dataset_snapshots').select('id,symbol,provider,interval,period,first_date,last_date,observation_count,dataset_sha256,quality,captured_at')
  .eq('user_id',owner).eq('symbol',symbol).eq('dataset_sha256',checksum).single();
 if(existing.error||!existing.data)throw Error('Could not locate the saved historical snapshot.');
 return existing.data;
}
export async function listSnapshots(owner:string,symbol?:string,id?:string){
 const db=dbAdmin();
 let query=db.from('market_dataset_snapshots')
  .select(id?'id,symbol,provider,interval,period,first_date,last_date,observation_count,dataset_sha256,quality,payload,captured_at':'id,symbol,provider,interval,period,first_date,last_date,observation_count,dataset_sha256,quality,captured_at')
  .eq('user_id',owner).order('captured_at',{ascending:false}).limit(id?1:30);
 if(symbol)query=query.eq('symbol',symbol);
 if(id)query=query.eq('id',id);
 const {data,error}=await query;
 if(error)throw Error('Historical snapshot retrieval unavailable.');
 return data??[];
}
