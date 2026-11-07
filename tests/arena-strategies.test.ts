import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENA_STRATEGIES,calculatePaperBuy,selectInvestorCandidate} from '../lib/arena-strategies.ts';
test('seven unique agents but only four investor strategies permitted at launch',()=>{
 assert.equal(ARENA_STRATEGIES.length,7);
 assert.equal(new Set(ARENA_STRATEGIES.map(s=>s.slug)).size,7);
 assert.equal(ARENA_STRATEGIES.filter(s=>s.enabled).length,4);
 assert.equal(ARENA_STRATEGIES.filter(s=>s.league==='trader'&&s.enabled).length,0);
});
test('symbol universe rules do not mix AI skeptic with Magnificent Seven',()=>{
 const skeptic=ARENA_STRATEGIES.find(s=>s.slug==='ai-skeptic')!;
 const mag7=new Set(['AAPL','MSFT','AMZN','GOOGL','META','NVDA','TSLA']);
 assert.ok(skeptic.symbols.every(x=>!mag7.has(x)));
 assert.equal(selectInvestorCandidate('mag7-purist',0),'AAPL');
 assert.equal(selectInvestorCandidate('mag7-purist',7),'AAPL');
 assert.equal(selectInvestorCandidate('opening-range',0),null);
});
test('paper buy reserves slippage and cash with no margin borrowing',()=>{
 const fill=calculatePaperBuy(5000,125,0.2,10,0);
 assert.ok(fill&&fill.shares>0);
 assert.ok(fill!.total<=1000);
 assert.equal(fill!.remaining,Number((5000-fill!.total).toFixed(4)));
 assert.equal(calculatePaperBuy(10,100),null);
 assert.equal(calculatePaperBuy(5000,100,1),null);
});
