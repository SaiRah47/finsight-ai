import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_PROMPTS} from '../lib/review-queue.ts';
test('review program contains 36 unique unlabeled candidate prompts across three real issuers',()=>{
 assert.equal(REVIEW_PROMPTS.length,36);
 assert.equal(new Set(REVIEW_PROMPTS.map(x=>x.id)).size,36);
 assert.equal(REVIEW_PROMPTS.filter(x=>x.intent==='abstention-probe').length,3);
 assert.deepEqual([...new Set(REVIEW_PROMPTS.map(x=>x.symbol))],['NVDA','MSFT','AAPL']);
});
