import {z} from 'zod';
import {authorizedOwner} from '@/lib/supabase/server';
export const runtime='nodejs';
const schema=z.object({symbol:z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.\-]{0,11}$/).nullable().optional(),
 title:z.string().trim().min(3).max(160),thesis:z.string().trim().min(1).max(4000),
 status:z.enum(['researching','watching','invalidated','archived']).default('researching'),
 evidence_url:z.string().url().max(600).nullable().optional()});
const acceptable=(url:string|null|undefined)=>!url||(()=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}})();
export async function GET(){
 const owner=await authorizedOwner();if(!owner)return Response.json({error:'Owner login required'},{status:401});
 const {data,error}=await owner.db.from('investment_journal').select('id,symbol,title,thesis,status,evidence_url,created_at,updated_at').eq('user_id',owner.user.id).order('created_at',{ascending:false}).limit(80);
 return error?Response.json({error:'Journal unavailable. Apply Phase 6 migration.'},{status:503}):Response.json({entries:data||[]},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const owner=await authorizedOwner();if(!owner)return Response.json({error:'Owner login required'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const parsed=schema.safeParse(body);
 if(!parsed.success||!acceptable(parsed.success?parsed.data.evidence_url:null))return Response.json({error:'Invalid journal entry or evidence URL.'},{status:400});
 const {error}=await owner.db.from('investment_journal').insert({...parsed.data,user_id:owner.user.id});
 return error?Response.json({error:'Could not save journal entry. Apply Phase 6 migration.'},{status:503}):Response.json({saved:true},{status:201});
}
export async function PATCH(request:Request){
 const owner=await authorizedOwner();if(!owner)return Response.json({error:'Owner login required'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const parsed=z.object({id:z.string().uuid(),status:z.enum(['researching','watching','invalidated','archived'])}).safeParse(body);
 if(!parsed.success)return Response.json({error:'Invalid status update'},{status:400});
 const {error}=await owner.db.from('investment_journal').update({status:parsed.data.status,updated_at:new Date().toISOString()}).eq('id',parsed.data.id).eq('user_id',owner.user.id);
 return error?Response.json({error:'Could not update status'},{status:503}):Response.json({saved:true});
}
export async function DELETE(request:Request){
 const owner=await authorizedOwner();if(!owner)return Response.json({error:'Owner login required'},{status:401});
 const id=new URL(request.url).searchParams.get('id');
 if(!id||!z.string().uuid().safeParse(id).success)return Response.json({error:'Invalid entry ID'},{status:400});
 const {error}=await owner.db.from('investment_journal').delete().eq('id',id).eq('user_id',owner.user.id);
 return error?Response.json({error:'Delete failed'},{status:503}):Response.json({deleted:true});
}
