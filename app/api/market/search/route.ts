import {NextRequest} from 'next/server';
import {authorizedOwner} from '@/lib/supabase/server';
import {MarketError,searchSymbols} from '@/lib/market';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!await authorizedOwner())return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const q=(request.nextUrl.searchParams.get('q')||'').trim();
 if(q.length<1||q.length>40||!/^[a-zA-Z0-9 .&\-]+$/.test(q))return Response.json({error:'Enter a stock name or symbol.'},{status:400});
 try{return Response.json({results:await searchSymbols(q)},{headers:{'Cache-Control':'private, max-age=300'}})}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Symbol search unavailable.'},{status:e instanceof MarketError?e.status:502})}
}