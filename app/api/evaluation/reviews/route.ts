import {z} from 'zod';
import {authorizedOwner} from '@/lib/supabase/server';
export const runtime='nodejs';
const schema=z.object({
 kind:z.enum(['retrieval','claim']),verdict:z.enum(['supported','unsupported','uncertain']),
 symbol:z.string().regex(/^[A-Z][A-Z0-9.\-]{0,11}$/).nullable().optional(),
 question:z.string().trim().min(3).max(500),excerpt:z.string().trim().min(1).max(1600),
 source_url:z.string().url().nullable().optional(),accession:z.string().regex(/^\d{10}-\d{2}-\d{6}$/).nullable().optional(),
 rank:z.number().int().min(1).max(5).nullable().optional()
});
const validSource=(url:string|null|undefined)=>{
 if(!url)return true;
 try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='www.sec.gov'&&/^\/Archives\/edgar\/data\/\d+\/\d{18}\/[A-Za-z0-9_.-]+$/.test(u.pathname)&&!u.search&&!u.hash}
 catch{return false}
};
export async function GET(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401});
 const {data,error}=await owner.db.from('research_evaluations')
  .select('id,kind,verdict,symbol,question,excerpt,source_url,accession,rank,created_at')
  .eq('user_id',owner.user.id).order('created_at',{ascending:false}).limit(100);
 if(error)return Response.json({error:'Evaluation table unavailable. Apply supabase/migrations/202611070002_phase5_evaluations.sql in Supabase.'},{status:503});
 const rows=data||[];
 const retrieval=rows.filter(r=>r.kind==='retrieval'),claims=rows.filter(r=>r.kind==='claim');
 const counts=(items:typeof rows)=>{
  const decided=items.filter(r=>r.verdict!=='uncertain');
  const topOne=decided.filter(r=>r.rank===1);
  return {reviewed:items.length,supported:items.filter(r=>r.verdict==='supported').length,
   unsupported:items.filter(r=>r.verdict==='unsupported').length,uncertain:items.filter(r=>r.verdict==='uncertain').length,
   judgedRelevantShare:decided.length?Number((decided.filter(r=>r.verdict==='supported').length/decided.length).toFixed(3)):null,
   topOneJudgedRelevantShare:topOne.length?Number((topOne.filter(r=>r.verdict==='supported').length/topOne.length).toFixed(3)):null,
   decided:decided.length,topOneJudged:topOne.length};
 };
 return Response.json({rows,summary:{retrieval:counts(retrieval),claims:counts(claims),sampleLimit:100},
  note:'Reviewer judgments are human supplied. Judged relevance shares cover only voluntarily reviewed passages, not complete document recall, model accuracy, or population precision.'},
  {headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const parsed=schema.safeParse(body);
 if(!parsed.success||!validSource(parsed.success?parsed.data.source_url:null))
  return Response.json({error:'Invalid evaluation input or SEC source URL.'},{status:400});
 const {data,error}=await owner.db.from('research_evaluations').insert({...parsed.data,user_id:owner.user.id}).select('id,created_at').single();
 if(error)return Response.json({error:'Evaluation could not be saved. Verify the Supabase Phase 5 migration.'},{status:503});
 return Response.json({saved:true,id:data.id,createdAt:data.created_at},{status:201,headers:{'Cache-Control':'no-store'}});
}
