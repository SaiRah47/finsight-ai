import {NextRequest} from 'next/server';
import {authorizedOwner} from '@/lib/supabase/server';
import {runRealSecBenchmark} from '@/lib/real-sec-runner';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:NextRequest){
 if(!await authorizedOwner())return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 let payload:unknown;
 try{payload=await request.json()}catch{return Response.json({error:'Invalid JSON.'},{status:400})}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return Response.json({error:'Malformed evaluation request.'},{status:400});
 const input=payload as Record<string,unknown>;
 const ticker=input.ticker;
 if(ticker!=='NVDA'&&ticker!=='MSFT'&&ticker!=='AAPL')return Response.json({error:'Choose NVDA, MSFT or AAPL.'},{status:400});
 if(typeof input.semantic!=='boolean')return Response.json({error:'Semantic opt-in must be an explicit boolean.'},{status:400});
 try{
  const result=await runRealSecBenchmark(ticker,input.semantic);
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Benchmark unavailable'},{status:502,headers:{'Cache-Control':'no-store'}})}
}
