import test from 'node:test';
import assert from 'node:assert/strict';
import {buildResearchReport} from '../lib/research-report.ts';
test('deterministic reports group evidence and show no fictitious verified claim score',()=>{
 const report=buildResearchReport({question:'Analyze NVIDIA volatility and SEC risks',symbol:'NVDA',route:'combined',asOf:'2026-11-06',mode:'evidence-only',
  answer:'20-session volatility 31%.',evidence:['Historical risk: 20-session annualized volatility 31%.','SEC 10-K filed 2026-02-25.','No relevant passage was retrieved.'],sources:[]});
 assert.equal(report.headline,'NVDA research briefing');
 assert.ok(report.sections.some(s=>s.kind==='risk'));
 assert.ok(report.sections.some(s=>s.kind==='sec'));
 assert.ok(report.sections.some(s=>s.kind==='limitations'));
 assert.equal(report.auditSummary.claims,0);
});
test('LLM reports flag unsupported citation-bearing claims for review',()=>{
 const report=buildResearchReport({question:'SEC filing summary',symbol:'NVDA',route:'filings',asOf:null,mode:'ai-assisted',answer:'Income was $999 billion [S1].',
  evidence:['Income was $2 billion in the period.'],sources:[{id:'S1',label:'10-K',date:'2026-02-25',url:'https://www.sec.gov/Archives/edgar/data/1/000000000000000001/test.htm'}]});
 assert.equal(report.auditSummary.unsupported,1);
});
