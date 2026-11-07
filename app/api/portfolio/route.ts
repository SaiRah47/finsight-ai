import {z} from 'zod';
import {authorizedOwner} from '@/lib/supabase/server';
import {getQuote} from '@/lib/market';
import {valuePortfolio} from '@/lib/portfolio-math';
export const runtime='nodejs';
export const maxDuration=60;
const schema=z.object({symbol:z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.\-]{0,11}$/),
 shares:z.number().finite().positive().max(100_000_000),cost_basis_per_share:z.number().finite().min(0).max(100_000_000).nullable().optional(),
 notes:z.string().max(500).optional()});
async function owner(){return authorizedOwner()}
export async function GET(){
 const access=await owner();if(!access)return Response.json({error:'Owner login required'},{status:401});
 const {data,error}=await access.db.from('portfolio_holdings').select('id,symbol,shares,cost_basis_per_share,notes,created_at').eq('user_id',access.user.id).order('created_at',{ascending:false}).limit(30);
 if(error)return Response.json({error:'Portfolio table unavailable. Apply Phase 6 Supabase migration.'},{status:503});
 const holdings=(data||[]).map(r=>({...r,shares:Number(r.shares),cost_basis_per_share:r.cost_basis_per_share===null?null:Number(r.cost_basis_per_share)}));
 const quotes=[] as Awaited<ReturnType<typeof getQuote>>[];
 const errors:Record<string,string>={};
 // Limit bursts on the free-tier market provider. Missing quotes never invent a portfolio total.
 for(const record of holdings.slice(0,12)){
  try{quotes.push(await getQuote(record.symbol))}
  catch(e){errors[record.symbol]=e instanceof Error?e.message:'Quote unavailable'}
 }
 const valuation=valuePortfolio(holdings.map(h=>({symbol:h.symbol,shares:h.shares,costBasisPerShare:h.cost_basis_per_share})),quotes);
 return Response.json({holdings,valuation,quoteErrors:errors,
  note:'Illustrative USD holdings values from latest provider quotes, not reconciled brokerage positions or guaranteed real-time prices.'},
  {headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const access=await owner();if(!access)return Response.json({error:'Owner login required'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return Response.json({error:'Invalid holding. Enter a valid ticker, positive shares and optional cost basis.'},{status:400});
 const {error}=await access.db.from('portfolio_holdings').upsert({user_id:access.user.id,...parsed.data,updated_at:new Date().toISOString()},{onConflict:'user_id,symbol'});
 if(error)return Response.json({error:'Could not save holding. Verify Phase 6 migration and unique symbol.'},{status:503});
 return Response.json({saved:true},{status:201});
}
export async function DELETE(request:Request){
 const access=await owner();if(!access)return Response.json({error:'Owner login required'},{status:401});
 const id=new URL(request.url).searchParams.get('id');
 if(!id||!z.string().uuid().safeParse(id).success)return Response.json({error:'Invalid holding ID'},{status:400});
 const {error}=await access.db.from('portfolio_holdings').delete().eq('id',id).eq('user_id',access.user.id);
 return error?Response.json({error:'Could not delete holding'},{status:503}):Response.json({deleted:true});
}
