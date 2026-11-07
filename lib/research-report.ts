import {auditClaims,summarizeClaimAudit,type ClaimAudit} from './claim-evaluation';
export type ReportSource={id:string;label:string;url:string;date:string|null;type?:string};
export type ResearchSection={heading:string;observations:string[];kind:'market'|'risk'|'sec'|'limitations'};
export type ResearchReport={
 version:1;question:string;symbol:string|null;route:string;
 headline:string;asOf:string|null;mode:'ai-assisted'|'evidence-only';
 sections:ResearchSection[];sources:ReportSource[];audit:ClaimAudit[];
 auditSummary:ReturnType<typeof summarizeClaimAudit>;
 caveats:string[];generatedAt:string;
};
export function buildResearchReport(input:{
 question:string;symbol:string|null;route:string;asOf:string|null;
 mode:'ai-assisted'|'evidence-only';answer:string;evidence:string[];sources:ReportSource[];
}):ResearchReport{
 const groups:ResearchSection[]=[
  {heading:'Market observations',kind:'market',observations:[]},
  {heading:'Historical risk measurements',kind:'risk',observations:[]},
  {heading:'SEC disclosure evidence',kind:'sec',observations:[]},
  {heading:'Data gaps and limitations',kind:'limitations',observations:[]}
 ];
 for(const original of input.evidence.slice(0,22)){
  const value=original.replace(/\s+/g,' ').trim().slice(0,880);
  if(!value)continue;
  if(/unavailable|insufficient|limitation|not connected|could not|no relevant|not extracted|cannot|do not claim|do not infer/i.test(value))groups[3].observations.push(value);
  else if(/SEC |filing|XBRL|PASSAGE|accession|disclosure/i.test(value))groups[2].observations.push(value);
  else if(/volatility|momentum|drawdown|risk|historical/i.test(value))groups[1].observations.push(value);
  else groups[0].observations.push(value);
 }
 const audit=input.mode==='ai-assisted'?auditClaims(input.answer,input.sources,input.evidence):[];
 const title=input.symbol?input.symbol+' research briefing':'Research briefing';
 return {
  version:1,question:input.question,symbol:input.symbol,route:input.route,headline:title,asOf:input.asOf,
  mode:input.mode,sections:groups.filter(g=>g.observations.length>0),
  sources:input.sources.slice(0,10),audit,auditSummary:summarizeClaimAudit(audit),
  caveats:['Statements are drawn from dated observations, not forecasts or personalized investment advice.',
   'SEC section extraction and company-document coverage may be incomplete.',
   input.mode==='ai-assisted'?'LLM claims require independent inspection against the source; automated checks cannot certify truth.':'The narrative is deterministic; a semantic factual-accuracy assessment was not performed.'],
  generatedAt:new Date().toISOString()
 };
}
