/** Pure, source-independent diagnostics for forward paper agents.
 * Reviews don't alter their strategy or promise higher future returns.
 */
export type EquityObservation={day:string;equity:number};
export type ReviewSummary={
 sampleDays:number;firstDay:string|null;lastDay:string|null;netReturnPct:number|null;
 maxDrawdownPct:number|null;dailyVolatilityPct:number|null;observedNegativeDays:number;
 verdict:'insufficient-data'|'needs-investigation'|'observation-only';
 findings:string[];candidateChange:{parameter:'targetAllocation'|'none';current:number|null;candidate:number|null;reason:string;stage:'research-only'};
};
const round=(x:number)=>Number(x.toFixed(3));
export function reviewEquitySeries(observations:EquityObservation[],currentAllocation=0.2):ReviewSummary{
 const clean=observations.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.day)&&Number.isFinite(x.equity)&&x.equity>=0)
  .sort((a,b)=>a.day.localeCompare(b.day));
 const unique=clean.filter((x,i)=>i===0||x.day!==clean[i-1].day);
 const base={sampleDays:unique.length,firstDay:unique[0]?.day??null,lastDay:unique.at(-1)?.day??null,
  netReturnPct:null as number|null,maxDrawdownPct:null as number|null,dailyVolatilityPct:null as number|null,
  observedNegativeDays:0,verdict:'insufficient-data' as ReviewSummary['verdict'],findings:[] as string[],
  candidateChange:{parameter:'none' as 'none'|'targetAllocation',current:currentAllocation as number|null,candidate:null as number|null,reason:'',stage:'research-only' as const}};
 if(unique.length<5){
  base.findings.push('At least five distinct observed session dates are needed for preliminary diagnostics; no change is suggested.');
  base.candidateChange.reason='Insufficient forward observations.';
  return base;
 }
 let peak=5000,maxDrawdown=0;
 const changes:number[]=[];
 for(let i=0;i<unique.length;i++){
  const p=unique[i].equity;
  peak=Math.max(peak,p);
  if(peak>0)maxDrawdown=Math.max(maxDrawdown,(peak-p)/peak*100);
  if(i&&unique[i-1].equity>0)changes.push((p/unique[i-1].equity-1)*100);
 }
 const last=unique.at(-1)!.equity;
 const avg=changes.reduce((a,b)=>a+b,0)/(changes.length||1);
 const varSample=changes.length>1?changes.reduce((a,b)=>a+(b-avg)**2,0)/(changes.length-1):0;
 base.netReturnPct=round((last/5000-1)*100);
 base.maxDrawdownPct=round(maxDrawdown);
 base.dailyVolatilityPct=round(Math.sqrt(varSample));
 base.observedNegativeDays=changes.filter(x=>x<0).length;
 base.findings.push('Paper return '+base.netReturnPct+'%; observed peak-to-trough drawdown '+base.maxDrawdownPct+'%.');
 base.findings.push('Observed negative-return transitions: '+base.observedNegativeDays+' of '+changes.length+'.');
 if(unique.length<20){
  base.findings.push('Fewer than 20 observed sessions: performance is not sufficient to recommend strategy adjustment.');
  base.candidateChange.reason='Insufficient forward sample for changing a strategy.';
  return base;
 }
 // This is a research hypothesis rather than a production agent decision.
 if(maxDrawdown>=8){
  base.verdict='needs-investigation';
  base.candidateChange={parameter:'targetAllocation',current:currentAllocation,
   candidate:round(Math.max(0.05,currentAllocation-0.05)),
   reason:'Consider testing a smaller maximum single-order allocation in a separate shadow experiment; drawdown does not establish causation.',
   stage:'research-only'};
  base.findings.push('High observed drawdown warrants inspection of concentration, data coverage and timing.');
 }else{
  base.verdict='observation-only';
  base.candidateChange.reason='No evidence-based parameter revision is justified by this limited sample.';
 }
 return base;
}
export function compareCandidateWithBaseline(baseline:number[],candidate:number[]):{valid:boolean;baselineReturnPct:number|null;candidateReturnPct:number|null;deltaPct:number|null;reason:string}{
 if(baseline.length<20||candidate.length!==baseline.length||baseline.some(x=>!Number.isFinite(x))||candidate.some(x=>!Number.isFinite(x)))
  return {valid:false,baselineReturnPct:null,candidateReturnPct:null,deltaPct:null,reason:'At least 20 paired, valid, out-of-sample observations are required.'};
 const cumulative=(series:number[])=>series.reduce((value,r)=>value*(1+r/100),1);
 const b=Number(((cumulative(baseline)-1)*100).toFixed(3)),c=Number(((cumulative(candidate)-1)*100).toFixed(3));
 return {valid:true,baselineReturnPct:b,candidateReturnPct:c,deltaPct:Number((c-b).toFixed(3)),
  reason:'Descriptive paired comparison only. Data leakage, trading costs and statistical confidence require separate checks before promotion.'};
}
