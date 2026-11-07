import type {PriceBar} from './market';
import {calculateSignals} from './signals';

export type EventStudy={
 threshold:number;
 horizonSessions:number;
 eligibleSessions:number;
 eventCount:number;
 meanEventReturnPercent:number|null;
 positiveEventRatePercent:number|null;
 unconditionalMeanReturnPercent:number|null;
 firstEventDate:string|null;
 lastEventDate:string|null;
 caveat:string;
};
const average=(values:number[])=>values.reduce((sum,n)=>sum+n,0)/values.length;
const round=(n:number)=>Number(n.toFixed(2));
/**
 * Descriptive event study, not an executable strategy backtest.
 * At observation i, the activity score may inspect only bars [0..i].
 * Forward 5-day closes enter only the outcome statistic.
 */
export function evaluateAttentionEvents(symbol:string,bars:PriceBar[],horizonSessions=5,threshold=65):EventStudy{
 const rows=[...bars].sort((a,b)=>a.date.localeCompare(b.date)).filter(b=>Number.isFinite(b.close)&&b.close>0);
 const eventReturns:number[]=[],baseline:number[]=[],eventDates:string[]=[];
 for(let i=61;i+horizonSessions<rows.length;i++){
  const visible=rows.slice(0,i+1);
  const report=calculateSignals(symbol,visible);
  const score=report.attentionScore;
  if(score===null)continue;
  const futureReturn=(rows[i+horizonSessions].close/rows[i].close-1)*100;
  if(!Number.isFinite(futureReturn))continue;
  baseline.push(futureReturn);
  if(score>=threshold){
   eventReturns.push(futureReturn);
   eventDates.push(rows[i].date);
  }
 }
 return {threshold,horizonSessions,eligibleSessions:baseline.length,eventCount:eventReturns.length,
  meanEventReturnPercent:eventReturns.length?round(average(eventReturns)):null,
  positiveEventRatePercent:eventReturns.length?round(eventReturns.filter(x=>x>0).length/eventReturns.length*100):null,
  unconditionalMeanReturnPercent:baseline.length?round(average(baseline)):null,
  firstEventDate:eventDates[0]||null,lastEventDate:eventDates[eventDates.length-1]||null,
  caveat:'Exploratory overlapping 5-session forward close-to-close outcomes; no transaction costs, corporate-action adjustments, out-of-sample test, or trade execution. NOT a return forecast.'};
}
