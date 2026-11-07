import type {PriceBar} from './market.ts';
export type RiskSeries={symbol:string;weight:number;bars:PriceBar[]};
export type PortfolioRiskResult={sampleDays:number;startDate:string;endDate:string;annualizedVolatilityPct:number;largestDailyLossPct:number;largestDailyGainPct:number;approximation:string};
const fixed=(x:number)=>Number(x.toFixed(3));
/** Fixed-current-weight portfolio return approximation over intersecting completed daily bars. */
export function estimatePortfolioRisk(series:RiskSeries[],window=60):PortfolioRiskResult|null{
 if(series.length===0||series.some(x=>x.weight<0||!Number.isFinite(x.weight)))return null;
 const sum=series.reduce((a,b)=>a+b.weight,0);if(sum<=0||!Number.isFinite(sum))return null;
 const maps=series.map(s=>{
  const valid=s.bars.filter(b=>Number.isFinite(b.close)&&b.close>0)
   .slice().sort((a,b)=>a.date.localeCompare(b.date));
  const daily=new Map<string,number>();
  for(let i=1;i<valid.length;i++){
   const previous=valid[i-1],current=valid[i];
   if(current.date===previous.date||!current.date||!previous.date)continue;
   daily.set(current.date,current.close/previous.close-1);
  }
  return daily;
 });
 const common=[...maps[0].keys()].filter(date=>maps.every(m=>m.has(date))).sort().slice(-Math.max(21,Math.min(window,120)));
 if(common.length<21)return null;
 const returns=common.map(date=>series.reduce((total,item,i)=>total+(item.weight/sum)*(maps[i].get(date)||0),0));
 const avg=returns.reduce((a,b)=>a+b,0)/returns.length;
 const variance=returns.reduce((a,b)=>a+(b-avg)**2,0)/(returns.length-1);
 return {sampleDays:returns.length,startDate:common[0],endDate:common[common.length-1],
  annualizedVolatilityPct:fixed(Math.sqrt(variance)*Math.sqrt(252)*100),
  largestDailyLossPct:fixed(Math.min(...returns)*100),largestDailyGainPct:fixed(Math.max(...returns)*100),
  approximation:'Historical fixed-current-weight daily return estimate. Excludes intraday changes, fees, cash, distributions, rebalancing, and any unavailable symbols. Not a prediction or actual portfolio performance.'};
}
