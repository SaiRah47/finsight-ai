import {NextRequest} from 'next/server';
import {authorizedOwner} from '@/lib/supabase/server';
import {MarketError,getHistory,periods,validSymbol,type MarketPeriod} from '@/lib/market';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!await authorizedOwner())return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const symbol=(request.nextUrl.searchParams.get('symbol')||'').trim().toUpperCase();
 const period=(request.nextUrl.searchParams.get('period')||'1M').toUpperCase();
 if(!validSymbol(symbol)||!periods.includes(period as MarketPeriod))return Response.json({error:'Invalid symbol or period.'},{status:400});
 try{return Response.json(await getHistory(symbol,period as MarketPeriod),{headers:{'Cache-Control':'private, max-age=120'}})}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to fetch historical prices.'},{status:e instanceof MarketError?e.status:502})}
}