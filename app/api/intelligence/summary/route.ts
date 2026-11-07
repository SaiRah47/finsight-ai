import {authorizedOwner} from '@/lib/supabase/server';
export const runtime='nodejs';
export async function GET(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner authentication required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const [holdings,rules,journal,watchlist,runs]=await Promise.all([
  owner.db.from('portfolio_holdings').select('symbol,shares').eq('user_id',owner.user.id).limit(50),
  owner.db.from('watchlist_alert_rules').select('id,symbol,metric,threshold,enabled').eq('user_id',owner.user.id).limit(50),
  owner.db.from('investment_journal').select('id,title,symbol,status,created_at').eq('user_id',owner.user.id).order('created_at',{ascending:false}).limit(5),
  owner.db.from('watchlist_symbols').select('symbol').eq('user_id',owner.user.id).limit(100),
  owner.db.from('research_runs').select('id,question,route,created_at').eq('user_id',owner.user.id).order('created_at',{ascending:false}).limit(5)
 ]);
 const failed=[holdings,rules,journal,watchlist,runs].some(x=>x.error);
 if(failed)return Response.json({error:'Private intelligence data unavailable. Apply the Phase 6 migration and verify owner session.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return Response.json({
  portfolio:{positions:holdings.data?.length||0,symbols:(holdings.data||[]).map(x=>String(x.symbol))},
  rules:{count:rules.data?.length||0,enabled:(rules.data||[]).filter(x=>x.enabled).length},
  watchlist:{count:watchlist.data?.length||0},
  journal:{countRecent:journal.data?.length||0,latest:journal.data||[]},
  research:{latest:runs.data||[]},
  note:'Private saved-data snapshot. Alert conditions and market prices are NOT checked by this endpoint.',
  asOf:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
