import {authorizedOwner} from '@/lib/supabase/server';
import {arenaSnapshot,initializeArena,runInvestorCycle} from '@/lib/arena-server';
import {getQuote} from '@/lib/market';
export const runtime='nodejs';
export const maxDuration=60;
const failure=(error:unknown)=>Response.json({error:error instanceof Error?error.message:'Arena operation unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401});
 try{
  const snapshot=await arenaSnapshot(owner.user.id);
  if(!snapshot.initialized||new URL(request.url).searchParams.get('value')!=='true')return Response.json(snapshot,{headers:{'Cache-Control':'no-store'}});
  const symbols=[...new Set(snapshot.positions.filter(p=>p.shares>0).map(p=>p.symbol))].slice(0,14);
  const priceMap=new Map<string,{price:number;asOf:string|null}>();
  const failures:Record<string,string>={};
  for(let i=0;i<symbols.length;i+=3){
   await Promise.all(symbols.slice(i,i+3).map(async symbol=>{
    try{
     const q=await getQuote(symbol);
     if(q.currency!=='USD'||q.price<=0)throw Error('Positive USD quote unavailable');
     priceMap.set(symbol,{price:q.price,asOf:q.asOf});
    }catch(error){failures[symbol]=error instanceof Error?error.message:'Quote unavailable'}
   }));
  }
  const valuations=snapshot.agents.map(agent=>{
   const positions=snapshot.positions.filter(p=>p.agent_id===agent.id&&p.shares>0);
   const missing=positions.filter(p=>!priceMap.has(p.symbol)).map(p=>p.symbol);
   const holdingsValue=positions.reduce((sum,p)=>sum+p.shares*(priceMap.get(p.symbol)?.price||0),0);
   const complete=missing.length===0&&positions.every(p=>priceMap.get(p.symbol)?.asOf);
   const equity=complete?Math.round((agent.cash+holdingsValue)*100)/100:null;
   const returnPct=equity===null?null:Number(((equity-5000)/5000*100).toFixed(3));
   return {agentId:agent.id,equity,returnPct,unpricedSymbols:missing,
    valuedPositions:positions.filter(p=>priceMap.has(p.symbol)).map(p=>({symbol:p.symbol,shares:p.shares,quote:priceMap.get(p.symbol)!.price,
     observation:priceMap.get(p.symbol)!.asOf,marketValue:p.shares*priceMap.get(p.symbol)!.price}))};
  });
  return Response.json({...snapshot,valuations,quoteFailures:failures,pricingNote:'Provider-reported, potentially stale USD quotes. Unrealized paper P&L uses modeled fills and does not imply live executable prices or trading skill.'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error)}
}
export async function POST(request:Request){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid arena operation'},{status:400});
 const action=(body as Record<string,unknown>).action;
 try{
  if(action==='initialize')return Response.json({seasonId:await initializeArena(owner.user.id),created:true});
  if(action==='cycle')return Response.json(await runInvestorCycle(owner.user.id));
  return Response.json({error:'Unsupported arena operation'},{status:400});
 }catch(error){return failure(error)}
}
