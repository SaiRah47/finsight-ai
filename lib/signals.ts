import type {PriceBar} from './market';

export type SignalState='elevated'|'positive'|'negative'|'neutral'|'insufficient';
export type SignalMetric={
 id:'momentum20'|'momentum60'|'volatility20'|'volumeRatio'|'drawdown90';
 label:string;value:number|null;unit:'percent'|'multiple';
 status:SignalState;explanation:string;observations:number;
};
export type SignalReport={
 symbol:string;sampleCount:number;firstDate:string|null;lastDate:string|null;
 latestClose:number|null;latestVolume:number|null;
 metrics:SignalMetric[];attentionScore:number|null;attentionLabel:'Higher activity'|'Moderate activity'|'Lower activity'|'Insufficient data';
 scoreBreakdown:{name:string;points:number;max:number;reason:string}[];
 warnings:string[];dataSource:'Twelve Data';methodology:'Rules v1';
 closes:{date:string;close:number}[];
};

const round=(n:number,digits=2)=>Number(n.toFixed(digits));
function stdev(values:number[]):number|null{
 if(values.length<2)return null;
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 return Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1));
}
const statusFor=(metric:SignalMetric['id'],value:number|null):SignalState=>{
 if(value===null)return 'insufficient';
 if(metric==='momentum20'||metric==='momentum60')return value>=5?'positive':value<=-5?'negative':'neutral';
 if(metric==='volatility20')return value>=45?'elevated':'neutral';
 if(metric==='volumeRatio')return value>=1.8?'elevated':'neutral';
 return value<=-15?'elevated':'neutral';
};
export function calculateSignals(symbol:string,input:PriceBar[]):SignalReport{
 const bars=input.filter(b=>Number.isFinite(b.close)&&b.close>0&&Number.isFinite(b.volume??0)&&(!b.volume||b.volume>=0)).sort((a,b)=>a.date.localeCompare(b.date)).filter((b,i,all)=>i===0||b.date!==all[i-1].date);
 const first=bars[0],last=bars[bars.length-1];
 const n=bars.length,close=(offset:number)=>bars[n-1-offset]?.close;
 const change=(sessions:number):number|null=>
  n>sessions&&close(sessions)>0?round((close(0)/close(sessions)-1)*100):null;
 const logReturns=bars.slice(1).map((b,i)=>Math.log(b.close/bars[i].close));
 const vol=logReturns.length>=20?stdev(logReturns.slice(-20)):null;
 const annualized=vol===null?null:round(vol*Math.sqrt(252)*100);
 const window=bars.slice(-90);let peak=0,maxDrawdown=0;
 for(const bar of window){peak=Math.max(peak,bar.close);if(peak>0)maxDrawdown=Math.min(maxDrawdown,(bar.close/peak-1)*100)}
 const drawdown=n>=20?round(maxDrawdown):null;
 // Compare the last complete bar's volume to the PREVIOUS 20 daily bars, excluding itself.
 const priorVolumes=bars.slice(-21,-1).map(x=>x.volume).filter((v):v is number=>v!==null&&Number.isFinite(v)&&v>0);
 const enoughVolume=n>=21&&last.volume!==null&&last.volume>0&&priorVolumes.length>=15;
 const avgVolume=priorVolumes.length?priorVolumes.reduce((a,b)=>a+b,0)/priorVolumes.length:0;
 const volumeRatio=enoughVolume&&avgVolume>0?round(last.volume!/avgVolume):null;
 const rows:[SignalMetric['id'],string,number|null,SignalMetric['unit'],number,string][]=[
  ['momentum20','20-session momentum',change(20),'percent',Math.min(n,21),'Close-to-close change over 20 completed sessions'],
  ['momentum60','60-session momentum',change(60),'percent',Math.min(n,61),'Close-to-close change over 60 completed sessions'],
  ['volatility20','20-session realized volatility',annualized,'percent',Math.min(logReturns.length,20),'Sample standard deviation of 20 daily log returns, annualized with √252'],
  ['volumeRatio','Relative volume',volumeRatio,'multiple',priorVolumes.length,'Latest completed-session volume divided by mean of prior 20 sessions (at least 15 nonzero samples)'],
  ['drawdown90','90-session maximum drawdown',drawdown,'percent',Math.min(n,90),'Largest close-to-close decline from a previous peak within the last 90 sessions']
 ];
 const metrics=rows.map(([id,label,value,unit,observations,explanation])=>({id,label,value,unit,observations,explanation,status:statusFor(id,value)}));
 const find=(id:SignalMetric['id'])=>metrics.find(m=>m.id===id)?.value??null;
 const components=[
  {name:'Absolute 20-session momentum',max:30,value:find('momentum20'),calc:(v:number)=>Math.min(30,Math.abs(v)*1.5),reason:'Absolute price change; direction shown separately'},
  {name:'Relative volume',max:25,value:find('volumeRatio'),calc:(v:number)=>Math.min(25,Math.max(0,v-1)*20),reason:'Volume vs trailing session baseline'},
  {name:'Realized volatility',max:25,value:find('volatility20'),calc:(v:number)=>Math.min(25,v/2.4),reason:'Annualized variation in recent returns'},
  {name:'Historical drawdown',max:20,value:find('drawdown90'),calc:(v:number)=>Math.min(20,Math.abs(Math.min(0,v))*.8),reason:'Peak-to-trough decline in lookback'}
 ];
 const complete=components.every(c=>c.value!==null);
 const scoreBreakdown=components.map(c=>({name:c.name,points:c.value===null?0:round(c.calc(c.value)),max:c.max,reason:c.reason}));
 const attentionScore=complete?round(Math.min(100,scoreBreakdown.reduce((s,c)=>s+c.points,0)),0):null;
 const attentionLabel=attentionScore===null?'Insufficient data':attentionScore>=65?'Higher activity':attentionScore>=35?'Moderate activity':'Lower activity';
 const warnings:string[]=[];
 if(n<61)warnings.push('Fewer than 61 completed daily bars: some momentum or scoring metrics are unavailable.');
 if(volumeRatio===null)warnings.push('Insufficient valid volume observations for relative volume.');
 if(n<21)warnings.push('Insufficient daily history for realized volatility.');
 warnings.push('Attention score measures historical market activity, NOT expected return, upside probability, or a buy/sell signal.');
 return {symbol,sampleCount:n,firstDate:first?.date??null,lastDate:last?.date??null,
 latestClose:last?.close??null,latestVolume:last?.volume??null,
 metrics,attentionScore,attentionLabel,scoreBreakdown,warnings,dataSource:'Twelve Data',methodology:'Rules v1',
 closes:bars.slice(-45).map(b=>({date:b.date,close:b.close}))};
}
