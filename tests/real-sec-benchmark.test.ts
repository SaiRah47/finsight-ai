import test from 'node:test';
import assert from 'node:assert/strict';
import {REAL_SEC_CASES,evaluateRealSECText} from '../lib/real-sec-benchmark.ts';
import {extractFilingText} from '../lib/filing-retrieval.ts';
import {retrieveBM25} from '../lib/retrieval-comparison.ts';

test('real SEC manifest links only to fixed official archive sources',()=>{
 assert.equal(REAL_SEC_CASES.length,3);
 assert.deepEqual(REAL_SEC_CASES.map(x=>x.ticker),['NVDA','MSFT','AAPL']);
 for(const c of REAL_SEC_CASES){
  assert.match(c.url,/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/\d{18}\/[A-Za-z0-9_.-]+$/);
  assert.match(c.accession,/^\d{10}-\d{2}-\d{6}$/);
 }
});
test('the same document is evaluated for both rankers',()=>{
 const item=REAL_SEC_CASES[0];
 const html='<h2>Item 1A. Risk Factors</h2><p>'+
  ('Export control rules and market competition affect product sales. '.repeat(15))+
  'The export controls applicable to China are complex and cause uncertainty in deliveries. '+
  ('Export compliance monitoring remains important. '.repeat(30))+'</p>';
 const result=evaluateRealSECText(item,html);
 assert.equal(result.documentContainsAnchor,true);
 assert.deepEqual(result.comparison.map(x=>x.method),['weighted-lexical','BM25']);
 assert.ok(result.comparison.every(x=>x.retrieved<=3));
});
test('a missing SEC anchor is recorded as extraction coverage failure, never ranking miss',()=>{
 const result=evaluateRealSECText(REAL_SEC_CASES[2],'<p>Unrelated content. '.repeat(50));
 assert.equal(result.documentContainsAnchor,false);
 assert.equal(result.comparison.length,0);
 assert.ok(result.limitations.some(x=>x.includes('not a ranker failure')));
});
test('BM25 abstains on terms absent from source material',()=>{
 const doc=extractFilingText('<h2>Item 7. Financial Overview</h2><p>'+
  'Ordinary sales were modest and operations continued. '.repeat(30)+'</p>');
 assert.equal(retrieveBM25(doc,'astronomical quasar nebula',3).length,0);
});
