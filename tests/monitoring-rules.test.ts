import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionRule,classifyFilings} from '../lib/monitoring-rules.ts';
const rule={id:'123',symbol:'NVDA',metric:'price_above' as const,threshold:100,enabled:true};
const observation={symbol:'NVDA',price:101,changePercent:2,volatility20:null,volumeRatio:null,asOf:'2026-11-06'};
test('threshold only triggers on rising edge, not every scheduled scan',()=>{
 assert.equal(transitionRule(rule,observation,false).emit,true);
 assert.equal(transitionRule(rule,observation,true).emit,false);
 assert.equal(transitionRule(rule,{...observation,price:99},true).triggered,false);
});
test('missing observations never rearm an already triggered rule',()=>{
 const x=transitionRule(rule,null,true);assert.equal(x.triggered,true);assert.equal(x.emit,false);
});
test('SEC first scan seeds baseline, not a historical false alert',()=>{
 const ids=['0001045810-26-000002','0001045810-26-000001'];
 assert.deepEqual(classifyFilings(ids,null).newAccessions,[]);
 assert.deepEqual(classifyFilings(ids,ids[1]).newAccessions,[ids[0]]);
 assert.deepEqual(classifyFilings(ids,'0001045810-22-000001').newAccessions,[]);
});
