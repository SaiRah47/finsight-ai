import test from 'node:test';
import assert from 'node:assert/strict';
import {valuePortfolio} from '../lib/portfolio-math.ts';
import {evaluateAlert} from '../lib/alert-engine.ts';
test('portfolio valuation weights and cost basis use only actual quotes',()=>{
 const x=valuePortfolio([{symbol:'AAPL',shares:2,costBasisPerShare:100},{symbol:'MSFT',shares:1,costBasisPerShare:200}],
 [{symbol:'AAPL',price:150,currency:'USD',asOf:'2026-11-06'},{symbol:'MSFT',price:300,currency:'USD',asOf:'2026-11-06'}]);
 assert.equal(x.totalValue,600);
 assert.equal(x.costBasisTotal,400);
 assert.equal(x.unrealizedPnL,200);
 assert.equal(x.topWeightPct,50);
 assert.equal(x.concentrationHHI,0.5);
});
test('missing prices prevent a misleading complete portfolio total',()=>{
 const x=valuePortfolio([{symbol:'AAPL',shares:2,costBasisPerShare:100},{symbol:'MSFT',shares:1,costBasisPerShare:null}],
 [{symbol:'AAPL',price:150,currency:'USD',asOf:null}]);
 assert.equal(x.totalValue,null);
 assert.equal(x.coverageComplete,false);
 assert.deepEqual(x.unpricedSymbols,['MSFT']);
});
test('unsupported quote currency never gets added to a USD portfolio',()=>{
 const x=valuePortfolio([{symbol:'ABC',shares:2,costBasisPerShare:null}],
 [{symbol:'ABC',price:100,currency:'EUR',asOf:null}]);
 assert.equal(x.pricedCount,0);
 assert.equal(x.totalValue,null);
});
test('alert rules trigger against fresh input and abstain when inputs missing',()=>{
 const rule={id:'1',symbol:'AAPL',metric:'daily_change_abs' as const,threshold:4,enabled:true};
 const obs={symbol:'AAPL',price:100,changePercent:-5,volatility20:null,volumeRatio:null,asOf:'2026-11-06'};
 assert.equal(evaluateAlert(rule,obs).triggered,true);
 assert.equal(evaluateAlert(rule,{...obs,changePercent:null}).triggered,false);
 assert.equal(evaluateAlert(rule,null).value,null);
 assert.equal(evaluateAlert({...rule,enabled:false},obs).triggered,false);
});
test('below threshold is strict and never triggers at equality',()=>{
 const r={id:'p',symbol:'AAPL',metric:'price_below' as const,threshold:100,enabled:true};
 assert.equal(evaluateAlert(r,{symbol:'AAPL',price:100,changePercent:null,volatility20:null,volumeRatio:null,asOf:null}).triggered,false);
});
