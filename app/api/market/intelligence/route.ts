import {NextRequest} from 'next/server';
import {z} from 'zod';
import {authorizedOwner} from '@/lib/supabase/server';
import {getMarketIntelligence,archiveDailyHistory,listSnapshots} from '@/lib/market-intelligence';
import {validSymbol} from '@/lib/market';
export const runtime='nodejs';export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
function fail(error:unknown,status=503){
 return Response.json({error:error instanceof Error?error.message:'Market intelligence temporarily unavailable'},{status,headers});
}
export async function GET(req:NextRequest){
 const owner=await authorizedOwner();
 if(!owner)return fail(Error('Owner authentication required'),401);
 const symbol=(req.nextUrl.searchParams.get('symbol')??'').trim().toUpperCase();
 const view=req.nextUrl.searchParams.get('view')??'intelligence';
 if(view==='snapshots'){
  if(symbol&&!validSymbol(symbol))return fail(Error('Invalid symbol'),400);
  const id=req.nextUrl.searchParams.get('id');
  if(id&&!z.string().uuid().safeParse(id).success)return fail(Error('Invalid snapshot ID'),400);
  try{return Response.json({snapshots:await listSnapshots(owner.user.id,symbol||undefined,id||undefined)},{headers})}
  catch(e){return fail(e)}
 }
 if(view!=='intelligence'||!validSymbol(symbol))return fail(Error('Invalid symbol or view'),400);
 const fundamentals=req.nextUrl.searchParams.get('fundamentals')==='true';
 try{return Response.json(await getMarketIntelligence(symbol,fundamentals),{headers})}
 catch(e){return fail(e)}
}
export async function POST(req:NextRequest){
 const owner=await authorizedOwner();
 if(!owner)return fail(Error('Owner authentication required'),401);
 let input:unknown;
 try{input=await req.json()}catch{return fail(Error('Invalid JSON'),400)}
 const parsed=z.object({action:z.literal('archive-history'),symbol:z.string().transform(s=>s.trim().toUpperCase()).refine(validSymbol)}).safeParse(input);
 if(!parsed.success)return fail(Error('Invalid snapshot request'),400);
 try{return Response.json({snapshot:await archiveDailyHistory(owner.user.id,parsed.data.symbol),simulationOnly:true},{status:201,headers})}
 catch(e){return fail(e)}
}
