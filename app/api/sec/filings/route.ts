import {NextRequest} from 'next/server';
import {authorizedOwner} from '@/lib/supabase/server';
import {getCompanyFilings,SecError} from '@/lib/sec';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!await authorizedOwner())return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const symbol=(request.nextUrl.searchParams.get('symbol')||'').trim().toUpperCase();
 try{
  const data=await getCompanyFilings(symbol);
  return Response.json(data,{headers:{'Cache-Control':'private, max-age=300','Vary':'Cookie'}});
 }catch(error){
  return Response.json({error:error instanceof Error?error.message:'SEC filings lookup failed'},
   {status:error instanceof SecError?error.status:502,headers:{'Cache-Control':'no-store'}});
 }
}
