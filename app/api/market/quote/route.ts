import {NextRequest} from 'next/server';
import {authorizedOwner} from '@/lib/supabase/server';
import {MarketError,getQuote,validSymbol} from '@/lib/market';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!await authorizedOwner())return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const symbol=(request.nextUrl.searchParams.get('symbol')||'').trim().toUpperCase();
 if(!validSymbol(symbol))return Response.json({error:'Provide a valid symbol.'},{status:400});
 try{return Response.json(await getQuote(symbol),{headers:{'Cache-Control':'private, max-age=60'}})}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to fetch quote.'},{status:e instanceof MarketError?e.status:502})}
}