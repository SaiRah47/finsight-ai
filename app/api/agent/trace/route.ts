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
    const result=await runDemoResearch(parsed.data.question,ev=>send('trace',{executionId,...ev}));
    const sources=result.sources.slice(0,10).map((s,i)=>({...s,id:'S'+(i+1)}));
    send('trace',{executionId,step:'evidence',status:sources.length?'complete':'unavailable',sources,sourceCount:sources.length,mode:result.synthesisMode,at:new Date().toISOString()});
    let persisted=false;
    if(owner){
     send('trace',{executionId,step:'persistence',status:'running',at:new Date().toISOString()});
     const {data:run,error}=await owner.db.from('research_runs').insert({user_id:owner.user.id,question:parsed.data.question,route:result.route,answer:result.answer}).select('id').single();
     if(error){
      send('trace',{executionId,step:'persistence',status:'error',message:'Research could not be saved.',at:new Date().toISOString()});
     }else if(run){
      const {error:traceError}=await owner.db.from('execution_traces').insert({user_id:owner.user.id,run_id:run.id,events:[...traceEvents]});
      persisted=!traceError;
      send('trace',{executionId,step:'persistence',status:persisted?'complete':'error',at:new Date().toISOString()});
     }
    }
    send('result',{executionId,answer:result.answer,mode:result.synthesisMode==='llm'?'ai-assisted':'evidence-only',
     route:result.route,source:result.source,symbol:result.symbol,asOf:result.asOf,sources,persisted});
   }catch(error){
    send('error',{message:'Research workflow failed: '+(error instanceof Error?error.message:'unknown error')});
   }finally{controller.close()}
  })();
 }});
 return new Response(stream,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store, no-transform','x-content-type-options':'nosniff'}});
}
