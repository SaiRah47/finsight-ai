import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import {getQuote,MarketError} from '@/lib/market';
import {resolveResearchSymbol} from './symbol-resolution';
import {analyzeSymbol} from '@/lib/radar';

type Route='market'|'risk'|'filings';
const ResearchState=Annotation.Root({
 question:Annotation<string>(),
 route:Annotation<Route>(),
 evidence:Annotation<string[]>({reducer:(a,b)=>a.concat(b),default:()=>[]}),
 answer:Annotation<string>(),
 source:Annotation<'market-data'|'unavailable'|'demo'>(),
 asOf:Annotation<string|null>(),
 symbol:Annotation<string|null>()
});
const graph=new StateGraph(ResearchState)
.addNode('router',async state=>({route:/filing|10.k|10.q|sec/i.test(state.question)?'filings' as const:/risk|drawdown|volatil|exposure/i.test(state.question)?'risk' as const:'market' as const}))
.addNode('market',async state=>{
 const symbol=resolveResearchSymbol(state.question);
 if(!symbol)return {source:'unavailable' as const,symbol:null,asOf:null,evidence:['No recognized company or ticker was found. Try a supported company name (for example NVIDIA) or an explicit ticker such as $NVDA.']};
 try{
  const quote=await getQuote(symbol);
  return {source:'market-data' as const,symbol,asOf:quote.asOf,evidence:[
   `Twelve Data reported ${symbol} at ${quote.price} ${quote.currency} (observation: ${quote.asOf||'time unavailable'}; retrieved ${quote.fetchedAt}).`,
   `Previous close: ${quote.previousClose??'unavailable'}; change: ${quote.changePercent===null?'unavailable':quote.changePercent.toFixed(2)+'%'}; volume: ${quote.volume??'unavailable'}.`
  ]};
 }catch(error){
  return {source:'unavailable' as const,symbol,asOf:null,evidence:['Quote retrieval failed for '+symbol+': '+(error instanceof MarketError?error.message:'Market quote could not be retrieved.')]};
 }
})
.addNode('risk',async state=>{
 const symbol=resolveResearchSymbol(state.question);
 if(!symbol)return {source:'unavailable' as const,symbol:null,asOf:null,evidence:['A portfolio-level risk analysis requires actual positions, which are not connected. For historical single-stock volatility or drawdown, specify a company such as NVIDIA or a ticker such as NVDA.']};
 try{
  const report=await analyzeSymbol(symbol);
  const volatility=report.metrics.find(m=>m.id==='volatility20')?.value??null;
  const drawdown=report.metrics.find(m=>m.id==='drawdown90')?.value??null;
  return {source:'market-data' as const,symbol,asOf:report.lastDate,evidence:[
   `Twelve Data daily bars for ${symbol}: ${report.sampleCount} completed sessions through ${report.lastDate}.`,
   `20-session annualized realized volatility: ${volatility===null?'insufficient observations':volatility+'%'}; 90-session maximum historical drawdown: ${drawdown===null?'insufficient observations':drawdown+'%'}.`,
   'These are historical single-instrument statistics, not portfolio exposure, future risk probability, or a trade signal.'
  ]};
 }catch(error){return {source:'unavailable' as const,symbol,asOf:null,evidence:['Historical data retrieval failed for '+symbol+': '+(error instanceof Error?error.message:'Unknown provider error')]};}
})
.addNode('filings',async()=>({source:'unavailable' as const,evidence:['SEC filings have not been retrieved. No filing analysis can be supported yet.']}))
.addNode('synthesize',async state=>({answer:(state.source==='market-data'?'Verified market observation: ':'Research status: ')+state.evidence.join(' ')+' Quote timestamps are provider-reported and may be delayed. This is informational, not investment advice.'}))
.addEdge(START,'router')
.addConditionalEdges('router',state=>state.route,{market:'market',risk:'risk',filings:'filings'})
.addEdge('market','synthesize').addEdge('risk','synthesize').addEdge('filings','synthesize').addEdge('synthesize',END).compile();
export async function runDemoResearch(question:string){return graph.invoke({question,evidence:[],source:'demo',symbol:null,asOf:null});}
