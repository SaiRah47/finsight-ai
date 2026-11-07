/**
 * Pure risk/position arithmetic. Missing quotes are omitted, never filled with zeroes.
 * All figures are indicative, quote-timestamped and explicitly not brokerage balances.
 */
export type HoldingInput={symbol:string;shares:number;costBasisPerShare:number|null};
export type PortfolioQuote={symbol:string;price:number;currency:string;asOf:string|null};
export type ValuedHolding={symbol:string;shares:number;price:number;marketValue:number;costBasis:number|null;unrealizedPnL:number|null;weightPct:number;asOf:string|null};
export type PortfolioValuation={positions:ValuedHolding[];totalValue:number|null;pricedCount:number;unpricedSymbols:string[];topWeightPct:number|null;concentrationHHI:number|null;costBasisTotal:number|null;unrealizedPnL:number|null;coverageComplete:boolean;currency:string};
export function valuePortfolio(holdings:HoldingInput[],quotes:PortfolioQuote[]):PortfolioValuation{
 const map=new Map(quotes.filter(q=>Number.isFinite(q.price)&&q.price>=0&&q.currency==='USD').map(q=>[q.symbol,q]));
 const clean=holdings.filter(h=>Number.isFinite(h.shares)&&h.shares>0);
 const unpricedSymbols=clean.filter(h=>!map.has(h.symbol)).map(h=>h.symbol);
 const items=clean.flatMap(h=>{
  const q=map.get(h.symbol);
  if(!q)return [];
  const cost=h.costBasisPerShare!==null&&Number.isFinite(h.costBasisPerShare)&&h.costBasisPerShare>=0?h.costBasisPerShare*h.shares:null;
  return [{symbol:h.symbol,shares:h.shares,price:q.price,marketValue:q.price*h.shares,
    costBasis:cost,unrealizedPnL:cost!==null?q.price*h.shares-cost:null,weightPct:0,asOf:q.asOf}];
 });
 const sum=items.reduce((a,h)=>a+h.marketValue,0);
 const positions=items.map(h=>({...h,weightPct:sum>0?h.marketValue/sum*100:0})).sort((a,b)=>b.marketValue-a.marketValue);
 const complete=clean.length>0&&unpricedSymbols.length===0;
 const knownCost=complete&&positions.every(h=>h.costBasis!==null);
 const costTotal=knownCost?positions.reduce((a,h)=>a+(h.costBasis??0),0):null;
 const hhi=sum>0?positions.reduce((a,h)=>a+(h.marketValue/sum)**2,0):null;
 return {positions,totalValue:complete?sum:null,pricedCount:positions.length,
  unpricedSymbols,topWeightPct:complete&&positions.length?positions[0].weightPct:null,
  concentrationHHI:complete?hhi:null,costBasisTotal:costTotal,
  unrealizedPnL:costTotal!==null?sum-costTotal:null,coverageComplete:complete,currency:'USD'};
}
