import {NextRequest} from 'next/server';
import {authorizedOwner} from '@/lib/supabase/server';
import {getQuote,validSymbol} from '@/lib/market';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!await authorizedOwner())return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const list=(request.nextUrl.searchParams.get('symbols')||'').toUpperCase().split(',').map(s=>s.trim());
 const symbols=[...new Set(list)].filter(validSymbol);
 if(!symbols.length||symbols.length>4||symbols.length!==list.length)return Response.json({error:'Provide up to 4 valid, distinct symbols.'},{status:400});
 // Fetch only two symbols concurrently to reduce quota bursts.
 const results:{symbol:string;quote:Awaited<ReturnType<typeof getQuote>>|null;error:string|null}[]=[];
 for(let index=0;index<symbols.length;index+=2){
  const batch=await Promise.all(symbols.slice(index,index+2).map(async symbol=>{
   try{return {symbol,quote:await getQuote(symbol),error:null}}
   catch(e){return {symbol,quote:null,error:e instanceof Error?e.message:'Unavailable'}}
  }));
  results.push(...batch);
 }
 return Response.json({results},{headers:{'Cache-Control':'private, max-age=60'}});
}