import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase/server';
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get('code'),db=await serverDb();
 if(code&&db){
  const {error}=await db.auth.exchangeCodeForSession(code);
  if(!error)return NextResponse.redirect(url.origin+'/');
 }
 return NextResponse.redirect(url.origin+'/?auth_error=callback');
}