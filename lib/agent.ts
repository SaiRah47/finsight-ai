import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import {getQuote,MarketError,validSymbol} from '@/lib/market';

type Route='market'|'risk'|'filings';
const symbols=['AAPL','NVDA','MSFT','AMZN','GOOGL','GOOG','TSLA','META','SPY','QQQ','AMD','NFLX'];
function findTicker(question:string):string|null {
 const mention=question.toUpperCase().match(/\$([A-Z][A-Z0-9.-]{0,11})\b/);
 if(mention&&validSymbol(mention[1]))return mention[1];
 const tokens=question.toUpperCase().match(/\b[A-Z][A-Z0-9.-]{0,11}\b/g)||[];
 return tokens.find(x=>symbols.includes(x))||null;
}
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
 const symbol=findTicker(state.question);
 if(!symbol)return {source:'unavailable' as const,symbol:null,asOf:null,evidence:['No unambiguous supported ticker was found. Include a ticker such as AAPL or $NVDA to retrieve a verified quote.']};
 try{
  const quote=await getQuote(symbol);
  return {source:'market-data' as const,symbol,asOf:quote.asOf,evidence:[
   `Twelve Data reported ${symbol} at ${quote.price} ${quote.currency} (observation: ${quote.asOf||'time unavailable'}; retrieved ${quote.fetchedAt}).`,
   `Previous close: ${quote.previousClose??'unavailable'}; change: ${quote.changePercent===null?'unavailable':quote.changePercent.toFixed(2)+'%'}; volume: ${quote.volume??'unavailable'}.`
  ]};
 }catch(error){
  return {source:'unavailable' as const,symbol,asOf:null,evidence:[error instanceof MarketError?error.message:'Market quote could not be retrieved.']};
 }
})
.addNode('risk',async()=>({source:'unavailable' as const,evidence:['Portfolio risk analysis is not connected to verified holdings yet. No exposure or volatility score has been inferred.']}))
.addNode('filings',async()=>({source:'unavailable' as const,evidence:['SEC filings have not been retrieved. No filing analysis can be supported yet.']}))
.addNode('synthesize',async state=>({answer:(state.source==='market-data'?'Verified market observation: ':'Research status: ')+state.evidence.join(' ')+' Quote timestamps are provider-reported and may be delayed. This is informational, not investment advice.'}))
.addEdge(START,'router')
.addConditionalEdges('router',state=>state.route,{market:'market',risk:'risk',filings:'filings'})
.addEdge('market','synthesize').addEdge('risk','synthesize').addEdge('filings','synthesize').addEdge('synthesize',END).compile();
export async function runDemoResearch(question:string){return graph.invoke({question,evidence:[],source:'demo',symbol:null,asOf:null});}
