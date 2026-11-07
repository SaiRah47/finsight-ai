import {z} from 'zod';
import {runDemoResearch} from '@/lib/agent';
import {authorizedOwner} from '@/lib/supabase/server';
import {supabaseConfigured} from '@/lib/supabase/config';
export const runtime='nodejs';
const schema=z.object({question:z.string().trim().min(3).max(500)});
export async function POST(request:Request){
 const owner=supabaseConfigured()?await authorizedOwner():null;
 if(supabaseConfigured()&&!owner)return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 let input:unknown;try{input=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const parsed=schema.safeParse(input);if(!parsed.success)return Response.json({error:'Invalid question'},{status:400});
 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({start(controller){
  const executionId=crypto.randomUUID();
  const traceEvents:Record<string,unknown>[]=[];
  const send=(event:string,data:Record<string,unknown>)=>{
   if(event==='trace')traceEvents.push(data);
   controller.enqueue(encoder.encode('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n'));
  };
  void(async()=>{
   try{
    send('trace',{executionId,step:'router',status:'running',at:new Date().toISOString()});
    const result=await runDemoResearch(parsed.data.question);
    send('trace',{executionId,step:'router',status:'complete',route:result.route,at:new Date().toISOString()});
    send('trace',{executionId,step:result.route,status:'complete',evidenceCount:result.evidence?.length??0,at:new Date().toISOString()});
    send('trace',{executionId,step:'synthesize',status:'complete',at:new Date().toISOString()});
    let persisted=false;
    if(owner){
     const {data:run,error}=await owner.db.from('research_runs').insert({user_id:owner.user.id,question:parsed.data.question,route:result.route,answer:result.answer}).select('id').single();
     if(error){send('trace',{executionId,step:'persistence',status:'error',message:'Research could not be saved.'})}
     else if(run){
      const {error:traceError}=await owner.db.from('execution_traces').insert({user_id:owner.user.id,run_id:run.id,events:traceEvents});
      persisted=!traceError;
      send('trace',{executionId,step:'persistence',status:persisted?'complete':'error'});
     }
    }
    send('result',{executionId,answer:result.answer,mode:'demo',persisted});
   }catch{send('error',{message:'Workflow failed'});}finally{controller.close()}
  })();
 }});
 return new Response(stream,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store, no-transform','x-content-type-options':'nosniff'}});
}