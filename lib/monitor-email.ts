import 'server-only';
import {createClient} from '@supabase/supabase-js';
/**
 * Optional user-opted-in email delivery, never enabled by defaults.
 * Event ID is reused as the provider idempotency key to limit duplicate sends.
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
 let sent=0,failed=0;
 for(const ev of pending||[]){
  // Never follow SEC URLs; include source as plain text only. Limit email text to verified saved event contents.
  const body=[ev.title,ev.details,'Observation: '+(ev.observation_at||'Not provided'),
   ev.source_url?'Official filing: '+ev.source_url:'','This is informational and not investment advice.'].filter(Boolean).join('\n\n');
  try{
   const response=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'finsight-'+ev.id},
    body:JSON.stringify({from,to:[to],subject:'FinSight ATLAS · '+String(ev.symbol).slice(0,12)+' monitoring update',text:body}),
    signal:AbortSignal.timeout(10000)
   });
   if(!response.ok)throw Error('Email provider returned HTTP '+response.status);
   const {error}=await db.from('monitor_events').update({email_status:'delivered',email_error:null}).eq('id',ev.id).eq('user_id',owner);
   if(error)throw Error('Email sent but status write failed');
   sent++;
  }catch(error){
   failed++;
   await db.from('monitor_events').update({email_status:'failed',email_error:(error instanceof Error?error.message:'Delivery unavailable').slice(0,180)})
    .eq('id',ev.id).eq('user_id',owner);
  }
 }
 return {sent,failed};
}
