import {NextRequest} from 'next/server';
import {authorizedOwner} from '@/lib/supabase/server';
import {scanSymbols} from '@/lib/radar';
import {validSymbol} from '@/lib/market';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!await authorizedOwner())return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const raw=(request.nextUrl.searchParams.get('symbols')||'').trim();
 const items=raw.split(',').map(x=>x.trim().toUpperCase());
 const symbols=[...new Set(items)];
 if(!raw||items.length!==symbols.length||symbols.length>4||symbols.some(x=>!validSymbol(x))){
  return Response.json({error:'Provide between 1 and 4 unique valid tickers.'},{status:400,headers:{'Cache-Control':'no-store'}});
 }
 const results=await scanSymbols(symbols);
 return Response.json({results,methodology:'Rules v1',scope:'Historical single-instrument activity only; not portfolio risk or return prediction',fetchedAt:new Date().toISOString()},
  {headers:{'Cache-Control':'private, max-age=900','Vary':'Cookie'}});
}
