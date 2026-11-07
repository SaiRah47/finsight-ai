import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRetrieval} from '../lib/retrieval-evaluation.ts';
import {SEC_RETRIEVAL_CASES} from './fixtures/sec-retrieval-cases.ts';

test('synthetic retrieval benchmark maintains a conservative quality floor',()=>{
 const result=evaluateRetrieval(SEC_RETRIEVAL_CASES);
 assert.equal(result.cases,11);
 assert.equal(result.answerable,8);
 assert.equal(result.unanswerable,3);
 assert.ok(result.recallAt3>=0.75,
  'Recall@3 fell below floor. See evaluation report for per-case failures.');
 assert.ok(result.hitAt1>=0.625,
  'Hit@1 fell below floor. Top-ranked evidence has regressed.');
 assert.ok(result.falsePositiveRate<=0.34,
  'The retriever emitted too many irrelevant passages on unanswerable questions.');
});
test('evaluation records rank and abstention instead of making up labels',()=>{
 const result=evaluateRetrieval(SEC_RETRIEVAL_CASES);
 const negative=result.results.filter(r=>!r.expectedAnswer);
 assert.equal(negative.length,3);
 assert.ok(negative.every(x=>x.relevantRanks.length===0&&x.reciprocalRank===0));
 assert.ok(result.results.every(x=>x.retrieved<=3));
});
