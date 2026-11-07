/**
 * Seven reproducible strategy identities. V1 investor orders use deterministic
 * universe rotation; trader agents are paused until defensible intraday fills.
 * No LLM autonomy or performance claims.
 */
export type AgentSlug='ai-maximalist'|'ai-skeptic'|'mag7-purist'|'value-investor'|'momentum-trader'|'mean-reversion'|'opening-range';
export type Strategy={slug:AgentSlug;name:string;league:'investor'|'trader';thesis:string;symbols:readonly string[];targetAllocation:number;enabled:boolean};
export const ARENA_STRATEGIES:readonly Strategy[]=[
 {slug:'ai-maximalist',name:'AI Maximalist',league:'investor',thesis:'AI infrastructure and software exposure, long-term.',symbols:['NVDA','MSFT','AVGO','AMD'],targetAllocation:0.2,enabled:true},
 {slug:'ai-skeptic',name:'AI Skeptic',league:'investor',thesis:'Non-AI staples, healthcare and utilities exposure.',symbols:['PG','JNJ','KO','DUK'],targetAllocation:0.2,enabled:true},
 {slug:'mag7-purist',name:'Magnificent Seven Purist',league:'investor',thesis:'Restricted to the Magnificent Seven universe.',symbols:['AAPL','MSFT','AMZN','GOOGL','META','NVDA','TSLA'],targetAllocation:0.2,enabled:true},
 {slug:'value-investor',name:'Value Investor',league:'investor',thesis:'Conservative established businesses; valuation scoring is a future phase.',symbols:['BRK.B','JPM','CVX','PEP'],targetAllocation:0.2,enabled:true},
 {slug:'momentum-trader',name:'Momentum Trader',league:'trader',thesis:'Intraday breakout strategy; paused until intraday feed validation.',symbols:['NVDA','AAPL','MSFT'],targetAllocation:0.1,enabled:false},
 {slug:'mean-reversion',name:'Mean Reversion',league:'trader',thesis:'Intraday oversold reversion; paused until realistic bar execution.',symbols:['SPY','QQQ'],targetAllocation:0.1,enabled:false},
 {slug:'opening-range',name:'Opening Range Trader',league:'trader',thesis:'Opening-range breakout; paused until verified intraday timestamps.',symbols:['SPY','QQQ'],targetAllocation:0.1,enabled:false}
] as const;
export function strategyFor(slug:string){return ARENA_STRATEGIES.find(x=>x.slug===slug)}
export function selectInvestorCandidate(slug:string,priorDecisions:number):string|null{
 const strategy=strategyFor(slug);
 return !strategy||!strategy.enabled||strategy.league!=='investor'?null:strategy.symbols[priorDecisions%strategy.symbols.length];
}
export type PaperFill={shares:number;reference:number;fill:number;fee:number;gross:number;total:number;remaining:number};
export function calculatePaperBuy(cash:number,reference:number,targetFraction=0.2,slippageBps=10,fee=0):PaperFill|null{
 if(!Number.isFinite(cash)||cash<=0||!Number.isFinite(reference)||reference<=0||
 !Number.isFinite(targetFraction)||targetFraction<=0||targetFraction>0.25||slippageBps<0||slippageBps>100||fee<0)return null;
 const fill=Math.round(reference*(1+slippageBps/10000)*1e6)/1e6;
 // Whole shares for first season; conservatively reserve the fee.
 const shares=Math.floor(Math.min(5000*targetFraction,cash-fee)/fill);
 if(shares<1)return null;
 const gross=Math.round(shares*fill*1e4)/1e4;
 const total=gross+fee;
 if(total>cash)return null;
 return {shares,reference,fill,fee,gross,total,remaining:Math.round((cash-total)*1e4)/1e4};
}
