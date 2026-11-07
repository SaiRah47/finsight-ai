import {NextRequest} from 'next/server';
import {authorizedOwner} from '@/lib/supabase/server';
import {getRelevantSecPassages} from '@/lib/sec-passages';
import {SecError} from '@/lib/sec';
import {validSymbol} from '@/lib/market';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!await authorizedOwner())return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const symbol=(request.nextUrl.searchParams.get('symbol')||'').trim().toUpperCase();
 const question=(request.nextUrl.searchParams.get('q')||'').trim();
 if(!validSymbol(symbol)||question.length<4||question.length>250)
  return Response.json({error:'Supply a valid symbol and a 4–250 character research question.'},{status:400});
 try{return Response.json(await getRelevantSecPassages(symbol,question),
   {headers:{'Cache-Control':'private, max-age=300','Vary':'Cookie'}})}
 catch(error){return Response.json({error:error instanceof Error?error.message:'SEC passage lookup unavailable'},
   {status:error instanceof SecError?error.status:502,headers:{'Cache-Control':'no-store'}})}
}
