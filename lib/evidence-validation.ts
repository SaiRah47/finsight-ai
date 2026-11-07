/**
 * Structural evaluation of source references and coverage.
 * This does NOT prove that prose is factually entailed by a source.
 */
export type SourceRecord={id:string;url:string;date:string|null;label:string};
export type EvidenceAssessment={
 citedIds:string[];unknownIds:string[];sourceCount:number;
 hasCitations:boolean;distinctCitedSources:number;citationCoverage:number;
 warnings:string[];passesStructuralGate:boolean;
};
export function assessEvidence(text:string,sources:SourceRecord[]):EvidenceAssessment{
 const citedIds=[...new Set([...text.matchAll(/\[([Ss]\d+)\]/g)].map(m=>m[1].toUpperCase()))];
 const authorized=new Set(sources.map(s=>s.id.toUpperCase()));
 const unknownIds=citedIds.filter(id=>!authorized.has(id));
 const distinctCitedSources=citedIds.filter(id=>authorized.has(id)).length;
 const warnings:string[]=[];
 if(!citedIds.length)warnings.push('The generated answer contains no source citations.');
 if(unknownIds.length)warnings.push('Generated answer references unknown sources: '+unknownIds.join(', '));
 if(sources.length&&!sources.some(s=>s.date))warnings.push('No cited source has a published observation or filing date.');
 if(!sources.length)warnings.push('No verified external sources were retrieved.');
 const hasCitations=citedIds.length>0;
 return {citedIds,unknownIds,sourceCount:sources.length,hasCitations,distinctCitedSources,
  citationCoverage:sources.length?Number((distinctCitedSources/sources.length).toFixed(3)):0,
  warnings,passesStructuralGate:hasCitations&&unknownIds.length===0&&sources.length>0};
}
