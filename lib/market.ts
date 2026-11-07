import 'server-only';

export type MarketQuote = {
 symbol:string; name:string; exchange:string; currency:string;
 price:number; change:number|null; changePercent:number|null; previousClose:number|null;
 open:number|null; high:number|null; low:number|null; volume:number|null;
 fiftyTwoWeekHigh:number|null; fiftyTwoWeekLow:number|null; asOf:string|null;
 provider:'Twelve Data'; freshness:'provider-reported'; fetchedAt:string;
};
export type PriceBar={date:string;open:number;high:number;low:number;close:number;volume:number|null};
export type HistoricalSeries={symbol:string;name:string;currency:string;interval:string;period:string;bars:PriceBar[];provider:'Twelve Data';fetchedAt:string};
export type SearchMatch={symbol:string;name:string;exchange:string;country:string;type:string};
export type MarketPeriod='1D'|'1W'|'1M'|'3M'|'1Y'|'5Y';
const config:Record<MarketPeriod,{interval:string;outputsize:number;ttl:number}>={
 '1D':{interval:'5min',outputsize:80,ttl:120},
 '1W':{interval:'1h',outputsize:70,ttl:300},
 '1M':{interval:'1day',outputsize:24,ttl:1800},
 '3M':{interval:'1day',outputsize:70,ttl:1800},
 '1Y':{interval:'1day',outputsize:260,ttl:3600},
 '5Y':{interval:'1week',outputsize:265,ttl:21600}
};
export const periods=Object.keys(config) as MarketPeriod[];
export const validSymbol=(value:string)=>/^[A-Z][A-Z0-9.\-]{0,11}$/.test(value);
function num(input:unknown):number|null {
 if(input===null||input===undefined||input==='')return null;
 const n=Number(input);return Number.isFinite(n)?n:null;
}
export class MarketError extends Error {
 constructor(message:string,public status=502){super(message)}
}
async function twelve(path:string,params:Record<string,string>,ttl:number):Promise<Record<string,unknown>> {
 const key=process.env.TWELVE_DATA_API_KEY;
 if(!key)throw new MarketError('Market data is not connected. Add TWELVE_DATA_API_KEY to Vercel and redeploy.',503);
 const url=new URL('https://api.twelvedata.com/'+path);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 url.searchParams.set('apikey',key);
 let res:Response;
 try{res=await fetch(url,{next:{revalidate:ttl},signal:AbortSignal.timeout(12000)})}
 catch{throw new MarketError('Market provider could not be reached. Try again shortly.',502)}
 if(!res.ok)throw new MarketError(res.status===429?'Market-data rate limit reached. Try again after the provider resets.':'Market provider returned HTTP '+res.status,res.status===429?429:502);
 let body:unknown;try{body=await res.json()}catch{throw new MarketError('Market provider returned an unreadable response.')}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new MarketError('Market provider returned unexpected data.');
 const obj=body as Record<string,unknown>;
 if(obj.status==='error'||obj.code){
  const code=num(obj.code);
  const message=String(obj.message||'Market request failed.');
  throw new MarketError(message,code===429?429:code===404?404:502);
 }
 return obj;
}
export async function getQuote(symbol:string):Promise<MarketQuote> {
 const d=await twelve('quote',{symbol},120);
 const price=num(d.close)??num(d.price);
 if(price===null)throw new MarketError('No valid quote is available for '+symbol+'.',404);
 const previousClose=num(d.previous_close);
 const change=num(d.change)??(previousClose!==null?price-previousClose:null);
 const changePercent=num(d.percent_change)??(previousClose&&change!==null?change/previousClose*100:null);
 const range=(d.fifty_two_week as Record<string,unknown>|undefined)??{};
 return {symbol,name:String(d.name||symbol),exchange:String(d.exchange||''),
 currency:String(d.currency||'USD'),price,change,changePercent,previousClose,
 open:num(d.open),high:num(d.high),low:num(d.low),volume:num(d.volume),
 fiftyTwoWeekHigh:num(range.high),fiftyTwoWeekLow:num(range.low),
 asOf:typeof d.datetime==='string'?d.datetime:null,provider:'Twelve Data',freshness:'provider-reported',fetchedAt:new Date().toISOString()};
}
export async function getHistory(symbol:string,period:MarketPeriod):Promise<HistoricalSeries> {
 const conf=config[period];
 const d=await twelve('time_series',{symbol,interval:conf.interval,outputsize:String(conf.outputsize),order:'ASC'},conf.ttl);
 if(!Array.isArray(d.values))throw new MarketError('No historical series is available for this symbol or interval.',404);
 const bars:PriceBar[]=[];
 for(const raw of d.values){
  if(!raw||typeof raw!=='object')continue;
  const b=raw as Record<string,unknown>;
  const open=num(b.open),high=num(b.high),low=num(b.low),close=num(b.close);
  if(typeof b.datetime==='string'&&open!==null&&high!==null&&low!==null&&close!==null)bars.push({date:b.datetime,open,high,low,close,volume:num(b.volume)});
 }
 if(!bars.length)throw new MarketError('The provider returned no usable historical observations.',404);
 bars.sort((a,b)=>a.date.localeCompare(b.date));
 const meta=(d.meta&&typeof d.meta==='object'?d.meta:{}) as Record<string,unknown>;
 return {symbol,name:String(meta.instrument_name||symbol),currency:String(meta.currency||'USD'),interval:conf.interval,period,bars,provider:'Twelve Data',fetchedAt:new Date().toISOString()};
}
export async function searchSymbols(query:string):Promise<SearchMatch[]> {
 const d=await twelve('symbol_search',{symbol:query,outputsize:'15'},3600);
 const raw=Array.isArray(d.data)?d.data:[];
 return raw.flatMap((item)=>{
  if(!item||typeof item!=='object')return [];
  const r=item as Record<string,unknown>;
  const symbol=String(r.symbol||'').toUpperCase();
  if(!validSymbol(symbol))return [];
  return [{symbol,name:String(r.instrument_name||r.name||symbol),exchange:String(r.exchange||''),country:String(r.country||''),type:String(r.instrument_type||r.type||'')}];
 }).filter(x=>!x.country||x.country==='United States').slice(0,12);
}
