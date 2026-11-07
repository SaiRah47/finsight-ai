import {authorizedOwner} from '@/lib/supabase/server';
import {supabaseConfigured} from '@/lib/supabase/config';
export const dynamic='force-dynamic';
export async function GET(){
 if(!supabaseConfigured())return Response.json({mode:'demo',authorized:true},{headers:{'Cache-Control':'no-store'}});
 const owner=await authorizedOwner();
 return Response.json({mode:process.env.FINSIGHT_OWNER_USER_ID?'private':'setup',authorized:Boolean(owner),email:owner?.user.email??null},{headers:{'Cache-Control':'no-store'}});
}