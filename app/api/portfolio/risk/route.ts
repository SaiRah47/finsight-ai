import {authorizedOwner} from '@/lib/supabase/server';
import {getHistory} from '@/lib/market';
import {valuePortfolio} from '@/lib/portfolio-math';
import {getQuote} from '@/lib/market';
import {estimatePortfolioRisk} from '@/lib/portfolio-risk';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(){
 const owner=await authorizedOwner();
 if(!owner)return Response.json({error:'Owner login required'},{status:401,headers:{'Cache-Control':'no-store'}});
 const {data,error}=await owner.db.from('portfolio_holdings').select('symbol,shares,cost_basis_per_share').eq('user_id',owner.user.id).limit(6);
 if(error)return Response.json({error:'Portfolio unavailable. Apply Phase 6 migration.'},{status:503});
 const holdings=(data||[]).map(r=>({symbol:String(r.symbol),shares:Number(r.shares),costBasisPerShare:r.cost_basis_per_share===null?null:Number(r.cost_basis_per_share)}));
 if(!holdings.length)return Response.json({risk:null,error:'Enter at least one holding first.'});
 if(holdings.length>4)return Response.json({risk:null,error:'Historical risk is currently limited to four holdings. No misleading partial-portfolio risk estimate will be displayed.'});
 try{
  const quotes=[] as Awaited<ReturnType<typeof getQuote>>[];
  for(let start=0;start<holdings.length;start+=2)
   quotes.push(...await Promise.all(holdings.slice(start,start+2).map(x=>getQuote(x.symbol))));
  const valued=valuePortfolio(holdings,quotes);
  if(!valued.coverageComplete||valued.totalValue===null||valued.totalValue<=0)
   return Response.json({risk:null,error:'All positions must have positive USD quotes before calculating full-portfolio historical risk.'});
  const histories=[] as Awaited<ReturnType<typeof getHistory>>[];
  for(let start=0;start<holdings.length;start+=2)
   histories.push(...await Promise.all(holdings.slice(start,start+2).map(x=>getHistory(x.symbol,'1Y'))));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const risk=estimatePortfolioRisk(valued.positions.map(position=>({
   symbol:position.symbol,weight:position.weightPct,
   bars:(histories.find(h=>h.symbol===position.symbol)?.bars||[]).filter(bar=>bar.date.slice(0,10)<today)
  })));
  return Response.json({risk,observedSymbols:valued.positions.map(x=>x.symbol),dataSource:'Twelve Data daily price histories',
   note:'Historical risk is a fixed-current-weight approximation over intersecting completed daily sessions. It is not a brokerage-reconciled risk model.'},
   {headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({risk:null,error:e instanceof Error?e.message:'Historical portfolio data unavailable'},{headers:{'Cache-Control':'no-store'}})}
}
