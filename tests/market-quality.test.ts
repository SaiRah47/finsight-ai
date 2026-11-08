import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHistory,exchangeDate,type DatedBar} from '../lib/market-quality.ts';
const d=(date:string,close=100):DatedBar=>({date,open:close,high:close+2,low:close-2,close,volume:1000});
const now=new Date('2026-11-08T16:00:00Z');
test('clean completed trading data is acceptable on Sunday',()=>{
 const quality=inspectHistory([d('2026-11-05'),d('2026-11-06')],now);
 assert.equal(quality.acceptable,true);assert.equal(quality.observations,2);
});
test('old source observation cannot drive actionable market evidence',()=>{
 const quality=inspectHistory([d('2026-10-30')],now);
 assert.equal(quality.acceptable,false);
 assert.ok(quality.issues.some(i=>i.code==='STALE'));
});
test('future observations are rejected',()=>{
 const quality=inspectHistory([d('2026-11-09')],now);
 assert.equal(quality.acceptable,false);
 assert.ok(quality.issues.some(i=>i.code==='FUTURE_BAR'));
});
test('repeated and out of order bars are rejected',()=>{
 const quality=inspectHistory([d('2026-11-06'),d('2026-11-05'),d('2026-11-05')],now);
 assert.equal(quality.acceptable,false);
 assert.ok(quality.issues.some(i=>i.code==='UNSORTED_OR_DUPLICATE'));
});
test('bad OHLCV cannot enter a replay-quality dataset',()=>{
 const bar=d('2026-11-06');bar.high=bar.close-10;
 const quality=inspectHistory([bar],now);
 assert.equal(quality.acceptable,false);
 assert.ok(quality.issues.some(i=>i.code==='INVALID_OHLCV'));
});
test('empty history fails closed',()=>{
 assert.equal(inspectHistory([],now).acceptable,false);
});
test('date conversion follows New York exchange calendar',()=>{
 assert.equal(exchangeDate(new Date('2026-11-09T01:00:00Z')),'2026-11-08');
});
