import {authorizedOwner} from '@/lib/supabase/server';
import {scanOwnerMonitoring} from '@/lib/monitor-service';
import {deliverPendingOwnerEmails} from '@/lib/monitor-email';
export const runtime='nodejs';
export const maxDuration=60;
/** One-click owner-only acceptance test; shares the daily dedupe key with Vercel cron. */
export async function POST(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner login required'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const result=await scanOwnerMonitoring();
  const delivery=result.status==='completed'||result.status==='partial'?await deliverPendingOwnerEmails():{sent:0,failed:0};
  return Response.json({...result,delivery},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Scheduled scan failed. Check monitoring configuration and server logs.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
