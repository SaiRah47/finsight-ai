/**
 * Independent, point-in-time comparison of two forward-paper strategy variants.
 * These helpers never optimize on the evaluation set or change active settings.
 */
export type ShadowMark={day:string;baselineEquity:number;candidateEquity:number};
export type ShadowGate={eligible:boolean;pairedSessions:number;baselineReturnPct:number|null;candidateReturnPct:number|null;returnDeltaPct:number|null;baselineDrawdownPct:number|null;candidateDrawdownPct:number|null;reasons:string[]};
const round=(n:number)=>Number(n.toFixed(3));
export function maxDrawdown(values:number[]):number{
 let peak=5000, worst=0;
 for(const n of values){if(!Number.isFinite(n)||n<0)return NaN;peak=Math.max(peak,n);if(peak>0)worst=Math.max(worst,(peak-n)/peak*100)}
 return round(worst);
}
export function compareShadowMarks(rows:ShadowMark[],minimum=20):ShadowGate{
 const byDay=new Map<string,ShadowMark>();
 for(const row of rows){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.day)||![row.baselineEquity,row.candidateEquity].every(x=>Number.isFinite(x)&&x>=0))continue;
  if(!byDay.has(row.day))byDay.set(row.day,row);
 }
 const sorted=[...byDay.values()].sort((a,b)=>a.day.localeCompare(b.day));
 const last=sorted.at(-1);
 const b=last?round((last.baselineEquity/5000-1)*100):null,c=last?round((last.candidateEquity/5000-1)*100):null;
 const bd=sorted.length?maxDrawdown(sorted.map(x=>x.baselineEquity)):null;
 const cd=sorted.length?maxDrawdown(sorted.map(x=>x.candidateEquity)):null;
 const reasons:string[]=[];
 if(sorted.length<minimum)reasons.push('At least '+minimum+' paired, dated paper-equity observations are required.');
 if(b===null||c===null||c<=b)reasons.push('The candidate has not demonstrated a positive net return improvement over the paired baseline.');
 if(bd===null||cd===null||!Number.isFinite(cd)||cd>bd+1)reasons.push('Candidate drawdown exceeds the baseline by more than one percentage point or lacks complete evidence.');
 // A pass is permission to REQUEST explicit review, not statistical proof of skill.
 if(!reasons.length)reasons.push('Mechanical gates passed; still requires human review, execution-cost assessment and explicit approval.');
 return {eligible:reasons.length===1&&reasons[0].startsWith('Mechanical gates'),pairedSessions:sorted.length,
  baselineReturnPct:b,candidateReturnPct:c,returnDeltaPct:b===null||c===null?null:round(c-b),
  baselineDrawdownPct:bd,candidateDrawdownPct:cd,reasons};
}
export type VariantBook={cash:number;positions:Record<string,{shares:number;averageCost:number}>};
export type ShadowFill={symbol:string;shares:number;price:number;total:number}|null;
export function simulateShadowBuy(book:VariantBook,symbol:string,price:number,fraction:number,slippageBps=10):{book:VariantBook;fill:ShadowFill}{
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(book.cash)||book.cash<0||fraction<0.05||fraction>0.25)return {book,fill:null};
 const fillPrice=Number((price*(1+slippageBps/10000)).toFixed(6));
 const shares=Math.floor(Math.min(5000*fraction,book.cash)/fillPrice);
 if(shares<1)return {book,fill:null};
 const total=Number((shares*fillPrice).toFixed(4));
 if(total>book.cash)return {book,fill:null};
 const old=book.positions[symbol]??{shares:0,averageCost:0};
 const next=old.shares+shares;
 return {book:{cash:Number((book.cash-total).toFixed(4)),positions:{...book.positions,
  [symbol]:{shares:next,averageCost:Number(((old.averageCost*old.shares+total)/next).toFixed(6))}}},
  fill:{symbol,shares,price:fillPrice,total}};
}
export function valueShadowBook(book:VariantBook,prices:Record<string,number>):number|null{
 let sum=book.cash;
 if(!Number.isFinite(sum)||sum<0)return null;
 for(const [symbol,p] of Object.entries(book.positions)){
  if(p.shares<=0)continue;
  const quote=prices[symbol];
  if(!Number.isFinite(quote)||quote<=0)return null;
  sum+=p.shares*quote;
 }
 return Number(sum.toFixed(4));
}
