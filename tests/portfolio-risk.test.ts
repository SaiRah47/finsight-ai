import test from 'node:test';
import assert from 'node:assert/strict';
import {estimatePortfolioRisk} from '../lib/portfolio-risk.ts';
const days=(base=100,rate=0)=>Array.from({length:65},(_,i)=>({
 date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),
 open:base*Math.pow(1+rate,i),high:base*Math.pow(1+rate,i),low:base*Math.pow(1+rate,i),
 close:base*Math.pow(1+rate,i),volume:100
}));
test('risk estimate returns zero for flat daily prices',()=>{
 const r=estimatePortfolioRisk([{symbol:'ABC',weight:1,bars:days()}]);
 assert.ok(r);assert.ok((r?.annualizedVolatilityPct??1)<0.001);
 assert.equal(r?.sampleDays,60);
});
test('cannot estimate risk with insufficient common daily returns',()=>{
 const short=days().slice(0,15);
 assert.equal(estimatePortfolioRisk([{symbol:'ABC',weight:1,bars:short}]),null);
});
test('rejects empty or invalid weights',()=>{
 assert.equal(estimatePortfolioRisk([]),null);
 assert.equal(estimatePortfolioRisk([{symbol:'ABC',weight:-1,bars:days()}]),null);
});
test('two matching assets produce coherent fixed-weight returns',()=>{
 const r=estimatePortfolioRisk([{symbol:'A',weight:0.5,bars:days(100,0.01)},{symbol:'B',weight:0.5,bars:days(200,-0.01)}]);
 assert.ok(r);assert.ok((r?.annualizedVolatilityPct??999)<0.01);
});
