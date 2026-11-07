import {authorizedOwner} from '@/lib/supabase/server';
import {recordArenaObservations,reviewArena,learningHistory} from '@/lib/arena-learning-server';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
export async function GET(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers});
 try{return Response.json(await learningHistory(owner.user.id),{headers})}
 catch(error){return Response.json({error:error instanceof Error?error.message:'Learning history unavailable'},{status:503,headers})}
}
export async function POST(request:Request){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers});
 let payload:unknown;
 try{payload=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400,headers})}
 const action=payload&&typeof payload==='object'&&!Array.isArray(payload)?(payload as Record<string,unknown>).action:null;
 try{
  if(action==='observe')return Response.json(await recordArenaObservations(owner.user.id),{headers});
  if(action==='review')return Response.json(await reviewArena(owner.user.id),{headers});
  return Response.json({error:'Unsupported learning action'},{status:400,headers});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Learning operation unavailable'},{status:503,headers})}
}
