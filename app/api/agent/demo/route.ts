import {z} from 'zod';
import {runDemoResearch} from '@/lib/agent';
import {authorizedOwner} from '@/lib/supabase/server';
import {supabaseConfigured} from '@/lib/supabase/config';
export const runtime='nodejs';
const schema=z.object({question:z.string().trim().min(3).max(500)});
export async function POST(request:Request){
 if(supabaseConfigured()&&!await authorizedOwner())return Response.json({error:'Owner authentication required'},{status:401});
 let data:unknown;try{data=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const parsed=schema.safeParse(data);if(!parsed.success)return Response.json({error:'Invalid question'},{status:400});
 try{const result=await runDemoResearch(parsed.data.question);return Response.json({route:result.route,answer:result.answer,evidence:result.evidence,mode:'demo'})}
 catch{return Response.json({error:'Workflow execution failed'},{status:500})}
}