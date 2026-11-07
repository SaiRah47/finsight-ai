/**
 * Conservative deterministic symbol/entity recognition for the current research demo.
 * Extend via an instrument search/entity service before supporting arbitrary companies.
 * This module performs NO provider lookups and is safe to unit-test.
 */
const ALIASES:ReadonlyArray<readonly [string,string]>= [
 ['NVIDIA','NVDA'],['NVIDIA CORPORATION','NVDA'],
 ['APPLE','AAPL'],['APPLE INC','AAPL'],
 ['MICROSOFT','MSFT'],['MICROSOFT CORPORATION','MSFT'],
 ['AMAZON','AMZN'],['AMAZON.COM','AMZN'],
 ['ALPHABET','GOOGL'],['GOOGLE','GOOGL'],
 ['TESLA','TSLA'],['META PLATFORMS','META'],['FACEBOOK','META'],
 ['ADVANCED MICRO DEVICES','AMD'],['NETFLIX','NFLX'],
 ['SPDR S&P 500','SPY'],['INVESCO QQQ','QQQ']
].sort((a,b)=>b[0].length-a[0].length);
const SYMBOLS=new Set(['AAPL','NVDA','MSFT','AMZN','GOOGL','GOOG','TSLA','META','SPY','QQQ','AMD','NFLX']);
function escapeRegex(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
const validTicker=(value:string)=>/^[A-Z][A-Z0-9.\-]{0,11}$/.test(value);
export function resolveResearchSymbol(question:string):string|null{
 const upper=question.toUpperCase();
 // Explicit $SYMBOL always takes priority, including tickers outside our quick picks.
 const tagged=upper.match(/\$([A-Z][A-Z0-9.\-]{0,11})(?![A-Z0-9.\-])/);
 if(tagged&&validTicker(tagged[1]))return tagged[1];
 // Exact standalone known tickers, not substrings like "META" inside "METADATA".
 const tokens=upper.match(/\b[A-Z][A-Z0-9.\-]{0,11}\b/g)||[];
 const direct=tokens.find(token=>SYMBOLS.has(token));
 if(direct)return direct;
 // Company aliases with strict word boundaries.
 for(const [alias,symbol] of ALIASES){
  if(new RegExp('(^|[^A-Z0-9])'+escapeRegex(alias)+'(?=$|[^A-Z0-9])').test(upper))return symbol;
 }
 return null;
}
