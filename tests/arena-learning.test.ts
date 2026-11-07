import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewEquitySeries,compareCandidateWithBaseline} from '../lib/arena-learning.ts';
const obs=(n:number,step=-1)=>Array.from({length:n},(_,i)=>({day:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),equity:5000+i*step}));
test('cannot recommend changes from the first few sessions',()=>{
 const result=reviewEquitySeries(obs(4));
 assert.equal(result.verdict,'insufficient-data');
 assert.equal(result.candidateChange.parameter,'none');
});
test('a 20-session drawdown suggests research only, never automatically promotes a strategy',()=>{
 const r=reviewEquitySeries(obs(24,-30));
 assert.equal(r.verdict,'needs-investigation');
 assert.equal(r.candidateChange.stage,'research-only');
 assert.ok(r.maxDrawdownPct!==null&&r.maxDrawdownPct>=8);
});
test('duplicate calendar days do not inflate evidence sample size',()=>{
 const o=obs(4);
 const r=reviewEquitySeries([...o,o[0],o[1]]);
 assert.equal(r.sampleDays,4);
});
test('shadow comparison rejects unpaired or too-short data',()=>{
 assert.equal(compareCandidateWithBaseline([1],[2]).valid,false);
 const r=compareCandidateWithBaseline(Array(20).fill(0),Array(20).fill(1));
 assert.equal(r.valid,true);
 assert.ok(r.deltaPct!==null&&r.deltaPct>0);
});
