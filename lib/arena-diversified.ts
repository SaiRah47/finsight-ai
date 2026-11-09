/**
 * Historical, simulation-only multi-stock competition. Pure deterministic engine:
 * no brokerage interfaces, no market orders, no external calls.
 * Signals are computed strictly from prior closes; fills use the following open.
 */
import type {ReplayBar,ReplayDataset,ReplaySlug} from './arena-replay';

export type LeagueProfile={slug:ReplaySlug;name:string;symbols:readonly string[];thesis:string};
export const LEAGUE_PROFILES:readonly LeagueProfile[]=[
 {slug:'ai-maximalist',name:'AI Maximalist',symbols:['NVDA','MSFT','AVGO'],thesis:'Momentum in AI-oriented technology; 30% maximum target per stock'},
 {slug:'ai-skeptic',name:'AI Skeptic',symbols:['PG','JNJ','KO'],thesis:'Scheduled defensive equal-weight allocation, not AI exposure'},
 {slug:'mag7-purist',name:'Magnificent Seven Purist',symbols:['AAPL','MSFT','AMZN'],thesis:'Trend-filtered equal allocation to a three-name Mag7 subset'},
 {slug:'value-investor',name:'Contrarian Price Proxy',symbols:['BRK.B','JPM','CVX'],thesis:'Buy below 20-day average; NOT a fundamentals-based value model'}
] as const;
export const LEAGUE_BENCHMARK='SPY';
export const LEAGUE_SYMBOLS=[...new Set([...LEAGUE_PROFILES.flatMap(x=>x.symbols),LEAGUE_BENCHMARK])];
export type LeagueTrade={day:string;signalDate:string;symbol:string;side:'buy'|'sell';shares:number;
 referencePrice:number;fillPrice:number;slippageUsd:number;reason:string};
export type LeagueDebate={day:string;signalDate:string;stage:'research'|'strategy'|'critic'|'risk'|'decision';role:string;message:string;sourceDates:string[]};
export type LeaguePoint={date:string;equity:number;cash:number;invested:number};
export type LeagueScore={slug:ReplaySlug|'benchmark';name:string;symbols:string[];startingCash:5000;
 endingEquity:number;cash:number;returnPct:number;maxDrawdownPct:number;annualizedVolatilityPct:number|null;
 sharpe0Pct:number|null;excessVsBenchmarkPct:number;trades:LeagueTrade[];debates:LeagueDebate[];curve:LeaguePoint[];
 holdings:{symbol:string;shares:number}[]};
export type LeagueTournament={version:2;simulationOnly:true;historical:true;methodology:'prior-close-signal-next-open-fill';
 startDate:string;endDate:string;sessions:number;symbols:string[];dataSources:{symbol:string;datasetId:string;checksum:string}[];
 benchmark:LeagueScore;results:LeagueScore[];limitations:string[]};
const rnd=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
const fillRnd=(x:number)=>Math.round(x*1e6)/1e6;
const datesOf=(data:ReplayDataset[])=>{
 const all=new Map(data.map(x=>[x.symbol,x]));
 for(const symbol of LEAGUE_SYMBOLS)if(!all.has(symbol))throw Error('Archive '+symbol+' daily history before starting the diversified league.');
 for(const d of data){
  if(!d.id||!d.sha256||!Array.isArray(d.bars)||d.bars.length<60)throw Error('Insufficient dated snapshot for '+d.symbol);
  let prior='';
  for(const b of d.bars){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||b.date<=prior||
    ![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||
    b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||
    b.volume!==null&&(!Number.isFinite(b.volume)||b.volume<0))throw Error('Invalid historical OHLCV for '+d.symbol);
   prior=b.date;
  }
 }
 const lookup=new Map(LEAGUE_SYMBOLS.map(symbol=>[symbol,new Map(all.get(symbol)!.bars.map(b=>[b.date,b]))]));
 const common=all.get(LEAGUE_BENCHMARK)!.bars.map(b=>b.date).filter(date=>LEAGUE_SYMBOLS.every(s=>lookup.get(s)!.has(date)));
 if(common.length<60)throw Error('At least 60 shared trading dates are needed; missing dates are never forward-filled.');
 return {common,lookup};
};
const performance=(slug:LeagueScore['slug'],name:string,symbols:string[],cash:number,holdings:Map<string,number>,
 trades:LeagueTrade[],debates:LeagueDebate[],curve:LeaguePoint[]):LeagueScore=>{
 const returns=curve.slice(1).map((v,i)=>v.equity/curve[i].equity-1);
 let peak=5000,maxDD=0;
 for(const p of curve){peak=Math.max(peak,p.equity);maxDD=Math.max(maxDD,(peak-p.equity)/peak*100)}
 const avg=returns.reduce((a,b)=>a+b,0)/(returns.length||1);
 const variance=returns.reduce((a,b)=>a+(b-avg)**2,0)/(returns.length||1);
 const deviation=Math.sqrt(variance);
 const vol=returns.length>1?rnd(deviation*Math.sqrt(252)*100):null;
 // Annualized Sharpe with 0% risk-free; zero volatility does not imply an infinite Sharpe.
 const sharpe=deviation>0.000000001?rnd(avg/deviation*Math.sqrt(252)):null;
 const endingEquity=curve[curve.length-1].equity;
 return {slug,name,symbols,startingCash:5000,endingEquity,cash:rnd(cash),returnPct:rnd((endingEquity/5000-1)*100),
  maxDrawdownPct:rnd(maxDD),annualizedVolatilityPct:vol,sharpe0Pct:sharpe,excessVsBenchmarkPct:0,
  trades,debates,curve,holdings:[...holdings].filter(([,qty])=>qty>0).map(([symbol,shares])=>({symbol,shares}))};
};
export function simulateDiversifiedLeague(datasets:ReplayDataset[]):LeagueTournament{
 const selected=LEAGUE_SYMBOLS.map(s=>datasets.find(d=>d.symbol===s)!);
 // Avoid accepting an extra duplicate symbol with conflicting snapshots.
 if(new Set(datasets.map(d=>d.symbol)).size!==datasets.length)throw Error('Duplicate snapshot symbols.');
 const {common,lookup}=datesOf(selected.filter(Boolean));
 const observed=(symbol:string,day:string)=>lookup.get(symbol)!.get(day)! as ReplayBar;
 const competitors=[...LEAGUE_PROFILES,{slug:'benchmark' as const,name:'SPY Buy & Hold',symbols:[LEAGUE_BENCHMARK],thesis:'Buy once and hold SPY price-only benchmark'}];
 const scores=competitors.map(profile=>{
  const holdings=new Map<string,number>(profile.symbols.map(s=>[s,0]));
  let cash=5000;const trades:LeagueTrade[]=[],debates:LeagueDebate[]=[],curve:LeaguePoint[]=[];
  for(let t=20;t<common.length;t++){
   const date=common[t],signalDate=common[t-1];
   if(t===20||(t-20)%20===0){
    const targets=new Map<string,number>();
    for(const symbol of profile.symbols){
     const closes=common.slice(t-20,t).map(day=>observed(symbol,day).close);
     const first=closes[0],last=closes[closes.length-1],sma=closes.reduce((a,b)=>a+b,0)/20;
     const momentum=last/first-1;
     const ok=profile.slug==='benchmark'||profile.slug==='ai-skeptic'||
      (profile.slug==='ai-maximalist'&&momentum>0)||
      (profile.slug==='mag7-purist'&&last>sma)||
      (profile.slug==='value-investor'&&last<sma);
     const weight=profile.slug==='benchmark'?0.95:ok?0.3:0;
     targets.set(symbol,weight);
     if(profile.slug!=='benchmark'){
      const summary=`${symbol}: 20-day mean ${sma.toFixed(2)}, prior close ${last.toFixed(2)}, prior 20-session change ${(momentum*100).toFixed(2)}%.`;
      debates.push({day:date,signalDate,stage:'research',role:'Market Analyst',message:summary,sourceDates:[common[t-20],signalDate]});
      debates.push({day:date,signalDate,stage:'strategy',role:'Strategy Agent',message:`${profile.thesis}. ${ok?'Candidate target '+(weight*100).toFixed(0)+'%':'No allocation signal'} for ${symbol}.`,sourceDates:[signalDate]});
      debates.push({day:date,signalDate,stage:'critic',role:'Counterargument Agent',message:'Historical technical signals can reverse, and concentration may increase drawdown. No contemporaneous fundamental advantage is proven.',sourceDates:[signalDate]});
     }
    }
    const markOpen=profile.symbols.reduce((value,s)=>value+(holdings.get(s)??0)*observed(s,date).open,cash);
    // Sell down holdings before buying new targets; long-only, whole shares and no leverage.
    for(const symbol of profile.symbols){
     const open=observed(symbol,date).open,existing=holdings.get(symbol)??0;
     const desired=Math.floor(markOpen*(targets.get(symbol)??0)/open);
     const sell=Math.max(0,existing-desired);
     if(sell>0){
      const price=fillRnd(open*0.999),proceeds=rnd(price*sell);
      cash=rnd(cash+proceeds);holdings.set(symbol,existing-sell);
      trades.push({day:date,signalDate,symbol,side:'sell',shares:sell,referencePrice:open,fillPrice:price,
       slippageUsd:rnd(sell*(open-price)),reason:'Risk-sized 20-session rebalance; previous-session evidence only'});
     }
    }
    for(const symbol of profile.symbols){
     const open=observed(symbol,date).open,existing=holdings.get(symbol)??0;
     const desired=Math.floor(markOpen*(targets.get(symbol)??0)/open);
     const price=fillRnd(open*1.001);
     const toBuy=Math.min(Math.max(0,desired-existing),Math.floor((cash+1e-7)/price));
     if(toBuy>0){
      const cost=rnd(price*toBuy);
      if(cost<=cash+0.000001){
       cash=rnd(cash-cost);holdings.set(symbol,existing+toBuy);
       trades.push({day:date,signalDate,symbol,side:'buy',shares:toBuy,referencePrice:open,fillPrice:price,
        slippageUsd:rnd(toBuy*(price-open)),reason:'Capped portfolio weight; 10 bps modeled fill slippage'});
      }
     }
    }
    if(profile.slug!=='benchmark'){
     debates.push({day:date,signalDate,stage:'risk',role:'Risk Guardian',message:'Long-only, cash-funded, whole shares, maximum 30% target allocation per symbol; sell-first execution and 10 bps slippage each side.',sourceDates:[signalDate]});
     debates.push({day:date,signalDate,stage:'decision',role:'Decision Council',message:trades.some(o=>o.day===date)?'Simulation-only rebalance recorded with next-open fills.':'No eligible adjustment; HOLD virtual positions.',sourceDates:[signalDate]});
    }
   }
   const invested=profile.symbols.reduce((sum,s)=>sum+(holdings.get(s)??0)*observed(s,date).close,0);
   const equity=rnd(cash+invested);
   if(cash< -0.001||!Number.isFinite(equity))throw Error('Invalid virtual ledger state');
   curve.push({date,equity,cash:rnd(cash),invested:rnd(invested)});
  }
  return performance(profile.slug,profile.name,[...profile.symbols],cash,holdings,trades,debates,curve);
 });
 const benchmark=scores.find(x=>x.slug==='benchmark')!;
 const results=scores.filter(x=>x.slug!=='benchmark').map(s=>({...s,excessVsBenchmarkPct:rnd(s.returnPct-benchmark.returnPct)}));
 return {version:2,simulationOnly:true,historical:true,methodology:'prior-close-signal-next-open-fill',startDate:common[20],
  endDate:common[common.length-1],sessions:common.length-20,symbols:LEAGUE_SYMBOLS,
  dataSources:LEAGUE_SYMBOLS.map(symbol=>{const d=datasets.find(x=>x.symbol===symbol)!;return {symbol,datasetId:d.id,checksum:d.sha256}}),
  benchmark,results,limitations:['Historical simulated strategies only; no real-money orders or brokerage interface.',
   'Four strategy rules are deterministic hypotheses, not independent LLM agents or actual investment advice.',
   'AI and value labels describe experiment themes, not verified AI exposure or valuation signals.',
   'At least 60 common raw sessions; first 20 are warmup; no forward-filling missing bars.',
   'Uses unadjusted provider OHLCV; splits/dividends and survivorship bias may materially distort comparisons.',
   'Prior closes determine next-open buy/sell fills; modeled 10 basis points both sides, zero other fees or interest.',
   'Whole shares, no shorting, no leverage, 30% target cap per stock; SPY buys 95% of initial equity.',
   'Sharpe uses a 0% risk-free rate and 252-session annualization; comparisons are price-only.']};
}
