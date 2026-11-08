/**
 * Pure, deterministic checks for historical market datasets.
 * Simulation-only: quality flags never authorize a paper order.
 */
export type DatedBar={date:string;open:number;high:number;low:number;close:number;volume:number|null};
export type QualityIssue={code:string;severity:'error'|'warning';message:string};
export type HistoryQuality={
 acceptable:boolean;observations:number;firstDate:string|null;lastDate:string|null;
 issues:QualityIssue[];source:'Twelve Data';
};
const day=(value:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const parsed=new Date(value+'T00:00:00Z');
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?parsed.getTime():null;
};
export function exchangeDate(now:Date=new Date()):string{
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function inspectHistory(bars:DatedBar[],now:Date=new Date()):HistoryQuality{
 const issues:QualityIssue[]=[];
 const issue=(code:string,severity:'error'|'warning',message:string)=>issues.push({code,severity,message});
 const observed=exchangeDate(now),today=day(observed)!;
 if(!bars.length)issue('EMPTY','error','Provider returned no historical bars.');
 if(bars.length>0&&bars.length<20)issue('INSUFFICIENT_HISTORY','warning','Fewer than 20 observations cannot support a reliable market signal.');
 let last=-Infinity;let firstDate:string|null=null,lastDate:string|null=null;
 for(const bar of bars){
  const t=day(bar.date);
  if(t===null){issue('INVALID_DATE','error','Historical series contains an invalid date.');continue}
  if(t<=last)issue('UNSORTED_OR_DUPLICATE','error','Historical dates must be strictly increasing.');
  if(t>today)issue('FUTURE_BAR','error','Historical series contains an observation from the future.');
  last=t;firstDate??=bar.date;lastDate=bar.date;
  if(![bar.open,bar.high,bar.low,bar.close].every(Number.isFinite)||bar.low<=0||
     bar.high<Math.max(bar.open,bar.close,bar.low)||bar.low>Math.min(bar.open,bar.close)||
     (bar.volume!==null&&(!Number.isFinite(bar.volume)||bar.volume<0)))
   issue('INVALID_OHLCV','error','Historical series contains inconsistent or non-positive OHLCV values.');
 }
 if(lastDate){
  const age=Math.floor((today-day(lastDate)!)/86400000);
  if(age>5)issue('STALE','warning','Last observed trading date exceeds the five-day research window.');
  if(age<0)issue('FUTURE_LAST_DATE','error','Latest market observation is future dated.');
 }
 // A dataset is stored even if stale, but the consumer must inspect its quality first.
 return {acceptable:!issues.some(x=>x.severity==='error')&&!issues.some(x=>['STALE','INSUFFICIENT_HISTORY'].includes(x.code)),
  observations:bars.length,firstDate,lastDate,issues,source:'Twelve Data'};
}
