import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateDiversifiedLeague,LEAGUE_SYMBOLS,LEAGUE_PROFILES} from '../lib/arena-diversified.ts';
import type {ReplayDataset} from '../lib/arena-replay.ts';
function fixtures():ReplayDataset[]{
 const days:string[]=[];for(let i=0;i<160;i++){const d=new Date(Date.UTC(2026,0,1+i));
 if(d.getUTCDay()!==0&&d.getUTCDay()!==6)days.push(d.toISOString().slice(0,10));}
 return LEAGUE_SYMBOLS.map((symbol,k)=>({id:'snapshot-'+k,symbol,sha256:(''+k).padStart(64,'a'),
  bars:days.map((date,i)=>{const price=40+k*12+i*(k%3===0?0.14:k%3===1?-0.025:0.06);
   return {date,open:price,high:price+3,low:price-3,close:price,volume:10000}})}));
}
test('independent virtual accounts and separate SPY benchmark on exactly the same dates',()=>{
 const league=simulateDiversifiedLeague(fixtures());
 assert.equal(league.version,2);assert.equal(league.simulationOnly,true);
 assert.equal(league.results.length,4);assert.equal(league.benchmark.slug,'benchmark');
 assert.equal(league.sessions,league.benchmark.curve.length);
 for(const agent of league.results){
  assert.equal(agent.startingCash,5000);assert.equal(agent.curve.length,league.sessions);
  assert.ok(agent.cash>=0);assert.ok(agent.trades.every(t=>t.shares>0));
  assert.deepEqual(agent.curve.map(x=>x.date),league.benchmark.curve.map(x=>x.date));
  assert.ok(agent.holdings.every(h=>h.shares>=0));
 }
});
test('each strategy stays inside its universe and traces earlier evidence',()=>{
 const league=simulateDiversifiedLeague(fixtures());
 for(const score of league.results){
  const permitted=LEAGUE_PROFILES.find(p=>p.slug===score.slug)!;
  assert.ok(score.trades.every(t=>permitted.symbols.includes(t.symbol)));
  assert.ok(score.trades.every(t=>t.signalDate<t.day));
  assert.ok(score.debates.some(x=>x.stage==='critic'));
  assert.ok(score.debates.some(x=>x.stage==='risk'));
  assert.ok(score.debates.every(x=>x.sourceDates.every(d=>d<x.day)));
 }
});
test('no later close can change earlier trade decisions or fills',()=>{
 const baseline=simulateDiversifiedLeague(fixtures());
 const tampered=fixtures();
 for(const d of tampered){const last=d.bars[d.bars.length-1];last.close-=0.5}
 const changed=simulateDiversifiedLeague(tampered);
 for(let i=0;i<4;i++)assert.deepEqual(changed.results[i].trades,baseline.results[i].trades);
 assert.deepEqual(changed.benchmark.trades,baseline.benchmark.trades);
});
test('no cash borrowing, and simulated buy/sell fills include adverse slippage',()=>{
 const league=simulateDiversifiedLeague(fixtures());
 for(const agent of [...league.results,league.benchmark]){
  assert.ok(agent.curve.every(x=>x.cash>=0));
  assert.ok(agent.trades.every(x=>x.side==='buy'?x.fillPrice>=x.referencePrice:x.fillPrice<=x.referencePrice));
 }
 assert.equal(league.benchmark.trades.filter(x=>x.side==='buy').length,1);
});
test('missing ticker, stale alignment, and inconsistent OHLC reject a tournament',()=>{
 assert.throws(()=>simulateDiversifiedLeague(fixtures().slice(1)),/Archive/);
 const notEnough=fixtures();for(const d of notEnough)d.bars=d.bars.slice(0,30);
 assert.throws(()=>simulateDiversifiedLeague(notEnough),/Insufficient dated snapshot|60/);
 const malformed=fixtures();malformed[0].bars[2].low=100000;
 assert.throws(()=>simulateDiversifiedLeague(malformed),/OHLCV/);
});
test('return difference equals percentage point excess over benchmark',()=>{
 const league=simulateDiversifiedLeague(fixtures());
 for(const agent of league.results)
  assert.ok(Math.abs(agent.excessVsBenchmarkPct-Math.round((agent.returnPct-league.benchmark.returnPct)*100)/100)<1e-6);
});
