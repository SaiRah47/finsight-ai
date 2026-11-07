import {z} from 'zod';
import {authorizedOwner} from '@/lib/supabase/server';
export const runtime='nodejs';
const schema=z.object({enabled:z.boolean(),email_enabled:z.boolean(),filings_enabled:z.boolean()});
export async function GET(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner login required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const [{data:settings,error:se},{data:runs,error:re},{data:events,error:ee}]=await Promise.all([
  owner.db.from('monitor_settings').select('enabled,email_enabled,filings_enabled,updated_at').eq('user_id',owner.user.id).maybeSingle(),
  owner.db.from('monitor_runs').select('id,run_day,status,started_at,completed_at,symbols_scanned,events_created,error_text').eq('user_id',owner.user.id).order('run_day',{ascending:false}).limit(20),
  owner.db.from('monitor_events').select('id,kind,symbol,title,details,source_url,observation_at,created_at,read_at,email_status').eq('user_id',owner.user.id).order('created_at',{ascending:false}).limit(80)
 ]);
 if(se||re||ee)return Response.json({error:'Monitoring tables unavailable. Apply Phase 7 SQL migration.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return Response.json({settings:settings||{enabled:false,email_enabled:false,filings_enabled:true},
  runs:runs||[],events:events||[],
  unread:(events||[]).filter(x=>!x.read_at).length,
  configuration:{schedulerReady:Boolean(process.env.CRON_SECRET&&process.env.SUPABASE_SECRET_KEY),
   emailProviderReady:Boolean(process.env.RESEND_API_KEY&&process.env.MONITOR_EMAIL_TO&&process.env.MONITOR_EMAIL_FROM)},
  disclaimer:'Once enabled and configured, cron checks at most three alert symbols and two watchlist SEC issuers daily. Alerts are historical, may be delayed, and no delivery SLA is guaranteed.'},
  {headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request:Request){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner login required'},{status:401});
 let input:unknown;try{input=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const parsed=schema.safeParse(input);
 if(!parsed.success)return Response.json({error:'Provide all three monitoring preferences.'},{status:400});
 if(parsed.data.email_enabled&&!parsed.data.enabled)return Response.json({error:'Email requires monitoring to be enabled.'},{status:400});
 if(parsed.data.email_enabled&&!(process.env.RESEND_API_KEY&&process.env.MONITOR_EMAIL_TO&&process.env.MONITOR_EMAIL_FROM))
  return Response.json({error:'Configure the email provider and recipient in Vercel before enabling email.'},{status:409});
 if(parsed.data.enabled&&!(process.env.CRON_SECRET&&process.env.SUPABASE_SECRET_KEY))
  return Response.json({error:'Configure CRON_SECRET and SUPABASE_SECRET_KEY in Vercel before enabling scheduled monitoring.'},{status:409});
 const {error}=await owner.db.from('monitor_settings').upsert({user_id:owner.user.id,...parsed.data,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 return error?Response.json({error:'Could not save settings. Verify Phase 7 migration.'},{status:503}):Response.json({saved:true,settings:parsed.data});
}
export async function PATCH(request:Request){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner login required'},{status:401});
 let input:unknown;try{input=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const parsed=z.object({id:z.string().uuid(),read:z.boolean()}).safeParse(input);
 if(!parsed.success)return Response.json({error:'Invalid event update'},{status:400});
 const {error}=await owner.db.from('monitor_events').update({read_at:parsed.data.read?new Date().toISOString():null}).eq('id',parsed.data.id).eq('user_id',owner.user.id);
 return error?Response.json({error:'Could not update event'},{status:503}):Response.json({saved:true});
}
