import 'server-only';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
/**
 * One optional daily digest for up to four new events.
 * Delivery is opt-in; provider idempotency is a best-effort duplicate guard,
 * not a distributed exactly-once delivery guarantee.
 */
export async function deliverPendingOwnerEmails():Promise<{sent:number;failed:number}>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY,owner=process.env.FINSIGHT_OWNER_USER_ID;
 const key=process.env.RESEND_API_KEY,to=process.env.MONITOR_EMAIL_TO,from=process.env.MONITOR_EMAIL_FROM;
 if(!url||!secret||!owner||!key||!to||!from)return {sent:0,failed:0};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))return {sent:0,failed:0};
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data:settings}=await db.from('monitor_settings').select('enabled,email_enabled').eq('user_id',owner).maybeSingle();
 if(!settings?.enabled||!settings?.email_enabled)return {sent:0,failed:0};
 const {data:pending}=await db.from('monitor_events').select('id,symbol,title,details,observation_at,source_url')
  .eq('user_id',owner).eq('email_status','pending').order('created_at',{ascending:true}).limit(4);
 if(!pending?.length)return {sent:0,failed:0};
 const ids=pending.map(e=>String(e.id)).sort();
 const idempotency='finsight-'+createHash('sha256').update(ids.join(':')).digest('hex').slice(0,40);
 const sections=pending.map((ev,i)=>[
  String(i+1)+'. '+String(ev.title).slice(0,200),
  String(ev.details).slice(0,1400),
  'Observation: '+String(ev.observation_at||'Not provided'),
  ev.source_url?'Official SEC filing: '+String(ev.source_url):''
 ].filter(Boolean).join('\n'));
 const digest=sections.join('\n\n---\n\n')+'\n\nInformational research only; not personalized investment advice. Adjust monitoring preferences in FinSight ATLAS.';
 try{
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':idempotency},
   body:JSON.stringify({from,to:[to],subject:'FinSight ATLAS · '+pending.length+' monitoring update'+(pending.length>1?'s':''),text:digest}),
   signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw Error('Email provider returned HTTP '+response.status);
  const {error}=await db.from('monitor_events').update({email_status:'delivered',email_error:null}).eq('user_id',owner).in('id',ids);
  if(error)throw Error('Email was accepted but event status write failed');
  return {sent:pending.length,failed:0};
 }catch(error){
  await db.from('monitor_events').update({email_status:'failed',email_error:(error instanceof Error?error.message:'Delivery failed').slice(0,180)})
   .eq('user_id',owner).in('id',ids);
  return {sent:0,failed:pending.length};
 }
}
