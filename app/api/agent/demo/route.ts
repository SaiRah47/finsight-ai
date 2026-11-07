import {z} from 'zod';
import {runDemoResearch} from '@/lib/agent';
export const runtime='nodejs';
const schema=z.object({question:z.string().trim().min(3).max(500)});
export async function POST(request:Request){let input:unknown;try{input=await request.json();}catch{return Response.json({error:'Invalid JSON'},{status:400});}const parsed=schema.safeParse(input);if(!parsed.success)return Response.json({error:'Question must be 3 to 500 characters'},{status:400});try{const result=await runDemoResearch(parsed.data.question);return Response.json({route:result.route,answer:result.answer,evidence:result.evidence,mode:'demo'});}catch{return Response.json({error:'Workflow execution failed'},{status:500});}}
