import {Annotation,StateGraph,START,END} from '@langchain/langgraph';
import {getQuote,MarketError} from '@/lib/market';
import {resolveResearchSymbol} from './symbol-resolution';
import {analyzeSymbol} from '@/lib/radar';
import {getCompanyFilings} from '@/lib/sec';
import {synthesizeOptional,type ResearchSource,type ResearchNodeEvent} from './research-synthesis';

type Route='market'|'risk'|'filings'|'combined';
type SourceStatus='market-data'|'sec-edgar'|'multi-source'|'unavailable';
type Finding={evidence:string[];sources:ResearchSource[];asOf:string|null;source:SourceStatus};
const unsupported=(message:string):Finding=>({evidence:[message],sources:[],asOf:null,source:'unavailable'});
function source(url:string,label:string,date:string|null,type:ResearchSource['type']):ResearchSource{
 return {id:'S0',url,label,date,type};
}
async function marketResearch(symbol:string):Promise<Finding>{
 try{
  const q=await getQuote(symbol);
  return {
   source:'market-data',asOf:q.asOf,
   sources:[source('https://twelvedata.com','Twelve Data quote for '+symbol,q.asOf,'market-provider')],
   evidence:[
    `Twelve Data reported ${symbol}: ${q.price} ${q.currency}; observation timestamp: ${q.asOf||'not provided'}; fetched: ${q.fetchedAt}.`,
    `Previous close: ${q.previousClose??'unavailable'}; reported daily percent change: ${q.changePercent===null?'unavailable':q.changePercent.toFixed(2)+'%'}; volume: ${q.volume??'unavailable'}.`
   ]
  };
 }catch(error){return unsupported('Market quote for '+symbol+' could not be retrieved: '+(error instanceof MarketError?error.message:'provider error'))}
}
async function riskResearch(symbol:string):Promise<Finding>{
 try{
  const report=await analyzeSymbol(symbol);
  const metric=(key:string)=>report.metrics.find(m=>m.id===key)?.value??null;
  return {
   source:'market-data',asOf:report.lastDate,
   sources:[source('https://twelvedata.com','Twelve Data historical daily bars for '+symbol,report.lastDate,'market-provider')],
   evidence:[
    `Historical ${symbol}: ${report.sampleCount} completed trading sessions through ${report.lastDate}. Current exchange-date bar omitted.`,
    `20-session annualized realized volatility: ${metric('volatility20')===null?'insufficient data':metric('volatility20')+'%'}. 90-session maximum historical drawdown: ${metric('drawdown90')===null?'insufficient data':metric('drawdown90')+'%'}.`,
    `20-session price momentum: ${metric('momentum20')===null?'insufficient data':metric('momentum20')+'%'}. Relative volume: ${metric('volumeRatio')===null?'insufficient data':metric('volumeRatio')+'x'}.`,
    'These are historical single-instrument metrics; there is no brokerage-linked portfolio risk analysis.'
   ]
  };
 }catch(error){return unsupported('Historical risk for '+symbol+' unavailable: '+(error instanceof Error?error.message:'provider error'))}
}
async function filingsResearch(symbol:string):Promise<Finding>{
 try{
  const company=await getCompanyFilings(symbol);
  const filings=company.filings.slice(0,6);
  const evidence=[
   `SEC EDGAR submissions for ${company.name} (${symbol}), CIK ${company.cik}; retrieved ${company.fetchedAt}.`,
   ...filings.map(f=>`Official SEC ${f.form} filed ${f.filed}; report period ${f.reportDate||'not stated'}; accession ${f.accession}; document ${f.url}.`),
   ...company.facts.map(f=>`SEC XBRL ${f.label}: ${f.value} ${f.unit}; reported period ending ${f.end}; filed ${f.filed}; source accession ${f.accession}. These facts may have different period lengths.`)
  ];
  if(!filings.length)evidence.push('No matching 10-K, 10-Q, or 8-K in the current submissions summary.');
  if(!company.facts.length)evidence.push('No matching validated revenue or net-income XBRL figures were available.');
  evidence.push('Full filing text and risk-factor sections have not been extracted; do not claim a filing states a particular narrative or a cause for market volatility.');
  return {
   source:filings.length?'sec-edgar':'unavailable',asOf:filings[0]?.filed??null,
   sources:filings.map(f=>source(f.url,`${company.name} ${f.form} filed ${f.filed}`,f.filed,'sec-filing')),
   evidence
  };
 }catch(error){return unsupported('SEC filings for '+symbol+' unavailable: '+(error instanceof Error?error.message:'SEC provider error'))}
}
function routeQuestion(question:string):Route{
 const filings=/filing|\bsec\b|\b10[- ]?[kq]\b|\b8[- ]?k\b|disclosur|annual report|quarterly report/i.test(question);
 const risk=/risk|drawdown|volatil|exposure|momentum|unusual volume/i.test(question);
 return filings&&risk?'combined':filings?'filings':risk?'risk':'market';
}
export function routeResearchQuestion(question:string):Route{return routeQuestion(question)}
const ResearchState=Annotation.Root({
 question:Annotation<string>(),
 route:Annotation<Route>(),
 evidence:Annotation<string[]>({reducer:(a,b)=>a.concat(b),default:()=>[]}),
 sources:Annotation<ResearchSource[]>({reducer:(a,b)=>a.concat(b),default:()=>[]}),
 answer:Annotation<string>(),
 source:Annotation<SourceStatus>(),
 asOf:Annotation<string|null>(),
 symbol:Annotation<string|null>(),
 synthesisMode:Annotation<'llm'|'deterministic'>()
});
export function createResearchGraph(progress?:(ev:ResearchNodeEvent)=>void){
 async function timed<T>(step:string,job:()=>Promise<T>):Promise<T>{
  const started=Date.now();
  progress?.({step,status:'running',at:new Date().toISOString()});
  try{
   const value=await job();
   progress?.({step,status:'complete',at:new Date().toISOString(),durationMs:Date.now()-started});
   return value;
  }catch(error){
   progress?.({step,status:'error',at:new Date().toISOString(),durationMs:Date.now()-started});
   throw error;
  }
 }
 const adapt=(finding:Finding)=>({source:finding.source,evidence:finding.evidence,sources:finding.sources,asOf:finding.asOf});
 const symbolFor=(question:string)=>resolveResearchSymbol(question);
 const graph=new StateGraph(ResearchState)
 .addNode('router',async state=>timed('router',async()=>({route:routeQuestion(state.question),symbol:symbolFor(state.question)})))
 .addNode('market',async state=>timed('market',async()=>{
  const symbol=state.symbol;
  return adapt(symbol?await marketResearch(symbol):unsupported('Specify a recognized company name or explicit ticker such as $NVDA.'));
 }))
 .addNode('risk',async state=>timed('risk',async()=>{
  const symbol=state.symbol;
  return adapt(symbol?await riskResearch(symbol):unsupported('Portfolio holdings are not connected. For individual-stock statistics specify NVIDIA or NVDA.'));
 }))
 .addNode('filings',async state=>timed('filings',async()=>{
  const symbol=state.symbol;
  return adapt(symbol?await filingsResearch(symbol):unsupported('Specify an SEC-reporting company name or ticker such as NVIDIA or NVDA.'));
 }))
 .addNode('combined',async state=>timed('combined',async()=>{
  const symbol=state.symbol;
  if(!symbol)return adapt(unsupported('Specify a company or ticker for combined market-risk and filings research.'));
  // Separate evidence collectors run concurrently; neither can fabricate absent observations.
  const [risk,filings]=await Promise.all([
   timed('risk',()=>riskResearch(symbol)),
   timed('filings',()=>filingsResearch(symbol))
  ]);
  const valid=[risk,filings].filter(f=>f.source!=='unavailable').length;
  return adapt({evidence:[...risk.evidence,...filings.evidence],
   sources:[...risk.sources,...filings.sources],asOf:filings.asOf??risk.asOf,
   source:valid===2?'multi-source':valid===1?(risk.source!=='unavailable'?risk.source:filings.source):'unavailable'});
 }))
 .addNode('synthesize',async state=>timed('synthesize',async()=>{
  const sources=state.sources.map((s,i)=>({...s,id:'S'+(i+1)})).slice(0,10);
  const fallback=state.evidence.length?state.evidence.join('\n\n'):'No verified evidence was retrieved.';
  const summary=state.source!=='unavailable'
   ?await synthesizeOptional(state.question,state.evidence,sources)
   :{text:null,mode:'deterministic' as const,reason:'No verified sources available.'};
  return {answer:(summary.text||fallback)+'\n\nResearch boundaries: dated observations only; no personalized investment advice. See the verified sources below.',
   synthesisMode:summary.mode};
 }))
 .addEdge(START,'router')
 .addConditionalEdges('router',s=>s.route,{market:'market',risk:'risk',filings:'filings',combined:'combined'})
 .addEdge('market','synthesize').addEdge('risk','synthesize').addEdge('filings','synthesize').addEdge('combined','synthesize')
 .addEdge('synthesize',END).compile();
 return graph;
}
export async function runDemoResearch(question:string,onProgress?:(ev:ResearchNodeEvent)=>void){
 const graph=createResearchGraph(onProgress);
 return graph.invoke({question,evidence:[],sources:[],source:'unavailable',asOf:null,symbol:null,synthesisMode:'deterministic'});
}
