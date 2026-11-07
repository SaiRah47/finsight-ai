import test from 'node:test';
import assert from 'node:assert/strict';
import {auditClaims,summarizeClaimAudit} from '../lib/claim-evaluation.ts';
const sources=[{id:'S1',label:'SEC 10-K',url:'https://www.sec.gov/Archives/edgar/data/1/000000000000000001/test.htm',date:'2026-01-31'}];
test('unknown source ID and unsupported numbers are flagged',()=>{
 const result=auditClaims('Revenue increased to $900 billion [S2].',sources,['Revenue increased to $10 billion.']);
 assert.equal(result[0].status,'unsupported');
 assert.ok(result[0].reasons.some(r=>r.includes('unknown')||r.includes('citation')));
});
test('matched facts remain needs-review, never automatically certified',()=>{
 const rows=auditClaims('Revenue increased to $10 billion [S1].',sources,['SEC filing: Revenue increased to $10 billion.']);
 assert.equal(rows[0].status,'needs-review');
 assert.equal(summarizeClaimAudit(rows).unsupported,0);
});
test('uncited unsupported statements are explicitly rejected',()=>{
 const rows=auditClaims('The share price will double next month.',sources,['Company files financial report.']);
 assert.equal(rows[0].status,'unsupported');
});
