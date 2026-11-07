import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
const ResearchState=Annotation.Root({question:Annotation<string>(),route:Annotation<'market'|'risk'|'filings'>(),evidence:Annotation<string[]>({reducer:(a,b)=>a.concat(b),default:()=>[]}),answer:Annotation<string>()});
const graph=new StateGraph(ResearchState)
.addNode('router',async s=>({route:/filing|10.k|10.q|sec/i.test(s.question)?'filings':/risk|drawdown|volatil|exposure/i.test(s.question)?'risk':'market'}))
.addNode('market',async()=>({evidence:['Market data adapter is not connected yet.']}))
.addNode('risk',async()=>({evidence:['Risk calculations are not connected yet.']}))
.addNode('filings',async()=>({evidence:['SEC filings adapter is not connected yet.']}))
.addNode('synthesize',async s=>({answer:'Routed to '+s.route+' workflow. '+s.evidence.join(' ')+' This is a demonstration, not investment advice.'}))
.addEdge(START,'router')
.addConditionalEdges('router',s=>s.route,{market:'market',risk:'risk',filings:'filings'})
.addEdge('market','synthesize').addEdge('risk','synthesize').addEdge('filings','synthesize').addEdge('synthesize',END).compile();
export async function runDemoResearch(question:string){return graph.invoke({question,evidence:[]});}
