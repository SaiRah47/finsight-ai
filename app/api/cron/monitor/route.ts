import {timingSafeEqual} from 'node:crypto';
import {scanOwnerMonitoring} from '@/lib/monitor-service';
import {deliverPendingOwnerEmails} from '@/lib/monitor-email';
export const runtime='nodejs';
export const maxDuration=60;
function authorized(value:string|null){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<24||!value?.startsWith('Bearer '))return false;
 const actual=Buffer.from(value.slice(7)),expected=Buffer.from(secret);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export async function GET(request:Request){
 if(!authorized(request.headers.get('authorization')))return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const summary=await scanOwnerMonitoring();
  const delivery=summary.status==='completed'||summary.status==='partial'?await deliverPendingOwnerEmails():{sent:0,failed:0};
  return Response.json({...summary,delivery},{headers:{'Cache-Control':'no-store'}});
 }catch{
  // Do not leak privileged environment state, database errors, or API keys.
  return Response.json({error:'Scheduled monitor unavailable. Inspect server logs and configuration.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
