/**
 * Structured evidence and role outputs for FinSight's paper-only Research Room.
 * A role's vote NEVER authorizes an order; the existing ledger remains separate.
 */
export type StudioStage='research'|'strategy'|'critic'|'risk'|'decision';
export type RoleStatus='complete'|'limited'|'blocked';
export type StudioEvidence={id:string;label:string;value:string;asOf:string|null;source:string;url:string|null;available:boolean};
export type RoleOutput={stage:StudioStage;role:string;status:RoleStatus;headline:string;explanation:string;
 vote:'support'|'challenge'|'veto'|'observe';confidence:'low'|'medium'|'high';citedIds:string[];durationMs:number;
 mode:'ai'|'rules';checks:string[]};
export type StudioTrace={id?:string;agentId:string;symbol:string;status:'complete'|'partial';researchMode:'ai-assisted'|'deterministic';
 verdict:'consider'|'hold'|'abstain';evidence:StudioEvidence[];steps:RoleOutput[];debate:RoleOutput[];
 guardrails:{tradePermitted:false;reason:string;riskVeto:boolean;providerCoverage:number};
 limitations:string[];elapsedMs:number;createdAt:string};
export const STUDIO_STAGES:readonly {id:StudioStage;name:string;short:string}[]=[
 {id:'research',name:'Research Analyst',short:'Collects dated evidence'},
 {id:'strategy',name:'Strategy Architect',short:'Forms a thesis'},
 {id:'critic',name:'Red-Team Critic',short:'Challenges assumptions'},
 {id:'risk',name:'Risk Guardian',short:'Applies hard controls'},
 {id:'decision',name:'Decision Council',short:'Resolves the debate'}
];
export function knownCitations(requested:string[],evidence:StudioEvidence[]):string[]{
 const known=new Set(evidence.filter(x=>x.available).map(x=>x.id));
 return [...new Set(requested.filter(x=>known.has(x)))].slice(0,5);
}
export function decideStudioOutcome(roles:RoleOutput[],available:number):{verdict:'consider'|'hold'|'abstain';veto:boolean;reason:string}{
 const risk=roles.find(x=>x.stage==='risk');
 if(available<2||!risk||risk.vote==='veto'||risk.status==='blocked')
  return {verdict:'abstain',veto:true,reason:'Evidence or hard risk gate is insufficient; no virtual order may be proposed for execution.'};
 const critic=roles.find(x=>x.stage==='critic'),strategy=roles.find(x=>x.stage==='strategy');
 if(!strategy||strategy.vote!=='support'||critic?.vote==='challenge')
  return {verdict:'hold',veto:false,reason:'The competing assessments do not justify considering a new position.'};
 return {verdict:'consider',veto:false,reason:'Discussion permits further human review only. No trade or allocation change is authorized.'};
}
export function deterministicStage(stage:StudioStage,evidence:StudioEvidence[],thesis:string):Omit<RoleOutput,'durationMs'>{
 const good=evidence.filter(x=>x.available);
 const ids=good.slice(0,3).map(x=>x.id);
 const quote=good.find(x=>x.id==='E1'),momentum=good.find(x=>x.id==='E2'),volatility=good.find(x=>x.id==='E3'),filing=good.find(x=>x.id==='E4');
 if(stage==='research')return {stage,role:'Research Analyst',status:good.length>=2?'complete':'limited',
  headline:good.length>=2?'Evidence map assembled':'Partial evidence coverage',
  explanation:'Reviewed '+good.length+' source-backed observations. '+(filing?.available?'Official SEC metadata is available.':'SEC metadata is unavailable; filing content is not inferred.'),
  vote:'observe',confidence:good.length>=3?'medium':'low',citedIds:ids,mode:'rules',checks:['Quote and risk timestamps retained','No unverified SEC claims']};
 if(stage==='strategy')return {stage,role:'Strategy Architect',status:good.length>=2?'complete':'limited',
  headline:'Evaluate '+thesis+' thesis',
  explanation:quote?.available?'Market quote is present. '+(momentum?.available?'Historical momentum can inform—but not guarantee—the thesis.':'Momentum is missing.'): 'A dated quote is missing, so no buy thesis can be established.',
  vote:quote?.available&&momentum?.available?'support':'observe',confidence:'low',citedIds:ids,mode:'rules',checks:['Restricted ticker universe','No forecast or unverified earnings claims']};
 if(stage==='critic')return {stage,role:'Red-Team Critic',status:'complete',
  headline:'What could invalidate this thesis?',
  explanation:volatility?.available?'Observed volatility and concentrated thematic exposure can make apparently compelling price trends fragile.':'Without complete risk observations, the thesis could be materially overstated.',
  vote:volatility?.available?'observe':'challenge',confidence:'low',citedIds:ids,mode:'rules',checks:['Challenge selection bias','Distinguish evidence from prediction']};
 if(stage==='risk')return {stage,role:'Risk Guardian',status:good.length>=2?'complete':'blocked',
  headline:good.length>=2?'Hard-risk screening':'Evidence gate blocks action',
  explanation:'The session is research-only. Regardless of debate votes, no market or paper order may be executed by this workflow.',
  vote:good.length>=2?'observe':'veto',confidence:'high',citedIds:ids,mode:'rules',
  checks:['No leverage or shorts','No market orders','Never mutate Season 1','Source dates required']};
 return {stage,role:'Decision Council',status:'complete',headline:'Debate resolved',explanation:'The research and counterarguments are retained as an auditable paper-only study.',vote:'observe',confidence:'low',citedIds:ids,mode:'rules',checks:['No automatic trade']};
}

/**
 * Calendar-date guard for provider observations. Twelve Data timestamps may be
 * exchange-local and omit a timezone, so never treat their time as UTC.
 * A five-day calendar window tolerates ordinary weekends and long weekends;
 * older or future-dated observations cannot satisfy a research evidence gate.
 * SEC filing dates are intentionally excluded from this market-data policy.
 */
export function observationFreshness(asOf:string|null,now:Date=new Date(),maxCalendarDays=5):
 {valid:boolean;reason:'current'|'missing'|'invalid'|'future'|'stale'}{
 if(!asOf)return {valid:false,reason:'missing'};
 const match=/^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/.exec(asOf);
 if(!match)return {valid:false,reason:'invalid'};
 const y=Number(match[1]),m=Number(match[2]),d=Number(match[3]);
 const observed=Date.UTC(y,m-1,d),parsed=new Date(observed);
 if(parsed.getUTCFullYear()!==y||parsed.getUTCMonth()!==m-1||parsed.getUTCDate()!==d)
  return {valid:false,reason:'invalid'};
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
 const current=Date.UTC(value('year'),value('month')-1,value('day'));
 const age=(current-observed)/86_400_000;
 if(age<0)return {valid:false,reason:'future'};
 if(age>maxCalendarDays)return {valid:false,reason:'stale'};
 return {valid:true,reason:'current'};
}
