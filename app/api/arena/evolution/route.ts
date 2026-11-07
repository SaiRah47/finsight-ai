import {z} from 'zod';
import {authorizedOwner} from '@/lib/supabase/server';
import {evolutionHistory,createShadowExperiment,stepShadowExperiment,changeStrategy,retireShadowExperiment} from '@/lib/arena-evolution-server';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
const uuid=z.string().uuid();
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),agentId:uuid,allocation:z.number().min(0.05).max(0.25)}),
 z.object({action:z.literal('step'),experimentId:uuid}),
 z.object({action:z.literal('retire'),experimentId:uuid,note:z.string().min(8).max(1000),confirmation:z.literal('RETIRE SHADOW EXPERIMENT')}),
 z.object({action:z.literal('promote'),experimentId:uuid,note:z.string().min(8).max(1000),confirmation:z.literal('PROMOTE PAPER STRATEGY')}),
 z.object({action:z.literal('rollback'),experimentId:uuid,note:z.string().min(8).max(1000),confirmation:z.literal('ROLL BACK PAPER STRATEGY')})
]);
export async function GET(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers});
 try{return Response.json(await evolutionHistory(owner.user.id),{headers})}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Shadow data unavailable'},{status:503,headers})}
}
export async function POST(request:Request){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers});
 let body:unknown;try{body=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400,headers})}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return Response.json({error:'Invalid shadow experiment parameters or missing explicit approval confirmation.'},{status:400,headers});
 try{
  const p=parsed.data;
  if(p.action==='create')return Response.json(await createShadowExperiment(owner.user.id,p.agentId,p.allocation),{status:201,headers});
  if(p.action==='step')return Response.json(await stepShadowExperiment(owner.user.id,p.experimentId),{headers});
  if(p.action==='retire')return Response.json(await retireShadowExperiment(owner.user.id,p.experimentId,p.note),{headers});
  return Response.json(await changeStrategy(owner.user.id,p.experimentId,p.action,p.note),{headers});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Shadow tournament operation unavailable'},{status:409,headers})}
}
