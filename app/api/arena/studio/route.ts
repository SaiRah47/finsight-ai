import {authorizedOwner} from '@/lib/supabase/server';
import {runArenaStudio,studioHistory} from '@/lib/arena-operations-server';
import {z} from 'zod';
export const runtime='nodejs';export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers});
 const id=new URL(request.url).searchParams.get('agentId');
 if(id&&!z.string().uuid().safeParse(id).success)return Response.json({error:'Invalid agent ID'},{status:400,headers});
 try{return Response.json({runs:await studioHistory(owner.user.id,id||undefined)},{headers})}
 catch(error){return Response.json({error:error instanceof Error?error.message:'Studio history unavailable'},{status:503,headers})}
}
export async function POST(request:Request){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers});
 let body:unknown;try{body=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400,headers})}
 const parsed=z.object({agentId:z.string().uuid()}).safeParse(body);
 if(!parsed.success)return Response.json({error:'Select a valid investor agent'},{status:400,headers});
 // Stream real server-stage events, not synthetic client animation events.
 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   const push=(kind:string,payload:unknown)=>{
    try{controller.enqueue(encoder.encode('event: '+kind+'\ndata: '+JSON.stringify(payload)+'\n\n'))}catch{}
   };
   try{
    await runArenaStudio(owner.user.id,parsed.data.agentId,event=>push('stage',event));
   }catch(error){push('error',{message:error instanceof Error?error.message:'Research session unavailable'})}
   finally{controller.close()}
  }
 });
 return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'}});
}
