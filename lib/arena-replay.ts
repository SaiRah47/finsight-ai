/**
 * Phase 11 historical paper tournament: no broker, network calls or real orders.
 * Each strategy uses one clearly disclosed representative ticker, NOT its full universe.
 * Signals use closes through t-1; fills use t open + 10 bps modeled buy slippage.
 */
export type ReplayBar={date:string;open:number;high:number;low:number;close:number;volume:number|null};
export type ReplayDataset={id:string;symbol:string;sha256:string;bars:ReplayBar[]};
export type ReplaySlug='ai-maximalist'|'ai-skeptic'|'mag7-purist'|'value-investor';
export type ReplayOrder={day:string;symbol:string;side:'buy';shares:number;signalDate:string;referencePrice:number;fillPrice:number;slippageUsd:number;reason:string};
export type ReplayPoint={date:string;equity:number;cash:number;holdingsValue:number};
export type ReplayResult={slug:ReplaySlug;symbol:string;datasetId:string;datasetSha256:string;startingCash:5000;endingCash:number;
 shares:number;equity:number;returnPct:number;maxDrawdownPct:number;orders:ReplayOrder[];curve:ReplayPoint[];limitations:string[]};
export type ReplayTournament={simulationOnly:true;methodology:'point-in-time-next-open';startDate:string;endDate:string;
 symbols:string[];results:ReplayResult[];sessions:number;limitations:string[]};
export const REPLAY_PROXIES:readonly {slug:ReplaySlug;symbol:string;name:string;rule:string}[]=[
 {slug:'ai-maximalist',symbol:'NVDA',name:'AI Maximalist',rule:'Buy on positive prior 20-session momentum'},
 {slug:'ai-skeptic',symbol:'PG',name:'AI Skeptic',rule:'Buy on scheduled 20-session intervals'},
 {slug:'mag7-purist',symbol:'AAPL',name:'Magnificent Seven Purist',rule:'Buy when prior close exceeds prior 20-session average'},
 {slug:'value-investor',symbol:'BRK.B',name:'Value Investor Proxy',rule:'Buy when prior close is below prior 20-session average (NOT fundamental valuation)'}
];
const money=(v:number)=>Math.round(v*100)/100;
const roundFill=(v:number)=>Math.round(v*1e6)/1e6;
function checked(d:ReplayDataset){
 if(!d.id||!d.sha256||!d.symbol||!Array.isArray(d.bars)||d.bars.length<60)
  throw Error('A versioned snapshot with at least 60 daily observations is required for '+d.symbol);
 let last='';
 for(const b of d.bars){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||b.date<=last||![b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)||
    b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.low>b.high||
    (b.volume!==null&&(!Number.isFinite(b.volume)||b.volume<0)))
   throw Error('Invalid or nonmonotonic OHLCV in archived dataset '+d.symbol);
  last=b.date;
 }
}
export function simulateTournament(datasets:ReplayDataset[]):ReplayTournament{
 const bySymbol=new Map(datasets.map(d=>[d.symbol,d]));
 for(const proxy of REPLAY_PROXIES)if(!bySymbol.has(proxy.symbol))throw Error('Archive '+proxy.symbol+' before starting the historical tournament.');
 const selected=REPLAY_PROXIES.map(p=>bySymbol.get(p.symbol)!);
 selected.forEach(checked);
 // Only intersect exact session dates; no forward filling or synthetic prices.
 const dates=selected[0].bars.map(b=>b.date).filter(date=>selected.every(d=>d.bars.some(b=>b.date===date)));
 if(dates.length<60)throw Error('At least 60 common dated trading sessions are required.');
 const results:ReplayResult[]=REPLAY_PROXIES.map(p=>{
  const dataset=bySymbol.get(p.symbol)!;
  const data=new Map(dataset.bars.map(b=>[b.date,b]));
  let cash=5000,shares=0,peak=5000,maxDrawdown=0;
  const orders:ReplayOrder[]=[],curve:ReplayPoint[]=[];
  for(let t=0;t<dates.length;t++){
   const bar=data.get(dates[t])!;
   // No same-day close leakage: evaluate through the previous session only.
   if(t>=20&&(t-20)%20===0){
    const prev=dates.slice(t-20,t).map(day=>data.get(day)!.close);
    const sma=prev.reduce((a,b)=>a+b,0)/20;
    const last=prev[prev.length-1],first=prev[0];
    const eligible=p.slug==='ai-skeptic'||(p.slug==='ai-maximalist'?last>first:
      p.slug==='mag7-purist'?last>sma:last<sma);
    if(eligible){
     const fill=roundFill(bar.open*1.001);
     const qty=Math.min(Math.floor(1000/fill),Math.floor(cash/fill));
     if(qty>0){
      const debit=money(qty*fill);
      if(debit<=cash){
       cash=money(cash-debit);shares+=qty;
       orders.push({day:dates[t],symbol:p.symbol,side:'buy',shares:qty,signalDate:dates[t-1],
        referencePrice:bar.open,fillPrice:fill,slippageUsd:money(qty*(fill-bar.open)),
        reason:p.rule+'; previous 20 closes, next-session open fill'});
      }
     }
    }
   }
   const holdingsValue=money(shares*bar.close),equity=money(cash+holdingsValue);
   peak=Math.max(peak,equity);
   maxDrawdown=Math.max(maxDrawdown,(peak-equity)/peak*100);
   curve.push({date:dates[t],equity,cash,holdingsValue});
  }
  const equity=curve[curve.length-1].equity;
  return {slug:p.slug,symbol:p.symbol,datasetId:dataset.id,datasetSha256:dataset.sha256,
   startingCash:5000 as const,endingCash:cash,shares,equity,returnPct:money((equity/5000-1)*100),
   maxDrawdownPct:money(maxDrawdown),orders,curve,
   limitations:['Single-stock proxy, not the full investment thesis','No dividends, split adjustment verification, interest, taxes or commissions',
    'Next-session open assumed available; modeled 10 bps buy slippage','Historical evaluation; not forward performance']};
 });
 return {simulationOnly:true,methodology:'point-in-time-next-open',startDate:dates[0],endDate:dates[dates.length-1],
  symbols:REPLAY_PROXIES.map(p=>p.symbol),results,sessions:dates.length,
  limitations:['Historical replay only; NO real trades or external orders','One representative ticker per strategy; not diversified or fundamentals-backed',
   'Matched common dates; no missing price interpolation','Signals use prior closes, fills at subsequent open; no intraday strategies',
   'Corporate actions and total-return adjustments are not verified; interpret results as experimental price-only proxies']};
}
