import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function middleware(req:NextRequest){
 // Public, self-contained portfolio tour: never parse or refresh a private Supabase session.
 if(req.nextUrl.pathname==='/showcase'||req.nextUrl.pathname.startsWith('/showcase/'))return NextResponse.next();
 let res=NextResponse.next({request:req});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return res;
 const client=createServerClient(url,key,{cookies:{
  getAll(){return req.cookies.getAll()},
  setAll(values){
   values.forEach(({name,value})=>req.cookies.set(name,value));
   res=NextResponse.next({request:req});
   values.forEach(({name,value,options})=>res.cookies.set(name,value,options));
  }
 }});
 await client.auth.getClaims();
 return res;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif)$).*)']};