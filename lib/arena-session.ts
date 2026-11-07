/** Conservative US regular-session paper execution guard. Does not model market holidays. */
export function easternSession(now:Date):{date:string;weekday:string;minute:number;open:boolean}{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now);
 const part=(type:string)=>parts.find(x=>x.type===type)?.value||'';
 const date=part('year')+'-'+part('month')+'-'+part('day');
 const minute=Number(part('hour'))*60+Number(part('minute'));
 const weekday=part('weekday');
 const open=!['Sat','Sun'].includes(weekday)&&minute>=9*60+35&&minute<=15*60+55;
 return {date,weekday,minute,open};
}
export function eligiblePaperQuote(now:Date,observation:string|null):{eligible:boolean;reason:string}{
 const session=easternSession(now);
 if(!session.open)return {eligible:false,reason:'Regular NYSE/Nasdaq session unavailable. No paper order submitted (weekend, outside hours, or possible holiday).'};
 if(!observation||observation.slice(0,10)!==session.date)
  return {eligible:false,reason:'Quote observation date is missing or does not match current New York exchange date.'};
 return {eligible:true,reason:'Regular-session clock and exchange observation date aligned; provider quote still may be delayed.'};
}
