import 'server-only';
import {getHistory,validSymbol} from './market';
import {calculateSignals,type SignalReport} from './signals';
import {evaluateAttentionEvents} from './event-study';

export type RadarResult={
 symbol:string;
 report:SignalReport|null;
 error:string|null;
};
function nyDate():string{
 // Date-only market observations are in the US exchange timezone.
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
export async function analyzeSymbol(symbol:string):Promise<SignalReport>{
 if(!validSymbol(symbol))throw Error('Invalid ticker symbol');
 // Reuse cached daily historical data already used by the Markets 1Y chart.
 const history=await getHistory(symbol,'1Y');
 const today=nyDate();
 // A same-day daily bar may be incomplete; omit it even after market close for a conservative completed-session baseline.
 const completed=history.bars.filter(b=>b.date.slice(0,10)<today);
 if(completed.length===0)throw Error('No completed daily sessions available.');
 const report=calculateSignals(symbol,completed);
 report.eventStudy=evaluateAttentionEvents(symbol,completed);
 report.warnings.unshift('Current US trading-day bar is excluded even after close to avoid treating partial volume as final.');
 return report;
}
export async function scanSymbols(symbols:string[]):Promise<RadarResult[]>{
 const results:RadarResult[]=[];
 // Batched to cap burst concurrency under Twelve Data Basic plan.
 for(let start=0;start<symbols.length;start+=2){
  const group=await Promise.all(symbols.slice(start,start+2).map(async symbol=>{
   try{return {symbol,report:await analyzeSymbol(symbol),error:null}}
   catch(error){return {symbol,report:null,error:error instanceof Error?error.message:'Analysis unavailable'}};
  }));
  results.push(...group);
 }
 return results;
}
