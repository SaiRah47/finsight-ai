import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';
export async function serverDb(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return null;
 const jar=await cookies();
 return createServerClient(url,key,{cookies:{getAll(){return jar.getAll()},setAll(values){try{values.forEach(({name,value,options})=>jar.set(name,value,options))}catch{/* Middleware refreshes cookies during server rendering. */}}}});
}
export async function authorizedOwner(){
 const db=await serverDb(),owner=process.env.FINSIGHT_OWNER_USER_ID;
 if(!db||!owner)return null;
 const {data:{user},error}=await db.auth.getUser();
 return error||!user||user.id!==owner?null:{db,user};
}