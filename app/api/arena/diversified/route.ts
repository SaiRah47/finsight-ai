import {authorizedOwner} from '@/lib/supabase/server';
import {diversifiedCoverage,diversifiedHistory,executeDiversifiedReplay} from '@/lib/arena-diversified-server';
export const runtime='nodejs';export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
const failure=(e:unknown)=>Response.json({error:e instanceof Error?e.message:'Simulation unavailable'},{status:503,headers});
export async function GET(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers});
 try{const [coverage,runs]=await Promise.all([diversifiedCoverage(owner.user.id),diversifiedHistory(owner.user.id)]);
  return Response.json({simulationOnly:true,coverage,runs},{headers})}
 catch(e){return failure(e)}
}
export async function POST(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers});
 try{return Response.json({simulationOnly:true,run:await executeDiversifiedReplay(owner.user.id)},{headers})}
 catch(e){return failure(e)}
}
