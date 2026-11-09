import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTournament,REPLAY_PROXIES,type ReplayDataset} from '../lib/arena-replay.ts';
function fixtures():ReplayDataset[]{
 const days:string[]=[];
 for(let i=0;i<135;i++){const d=new Date(Date.UTC(2026,0,1+i));if(d.getUTCDay()!==0&&d.getUTCDay()!==6)days.push(d.toISOString().slice(0,10));}
 return REPLAY_PROXIES.map((p,k)=>({id:'uuid-'+k,symbol:p.symbol,sha256:'x'.repeat(64),
  bars:days.map((date,i)=>{const close=80+(k+1)*10+i*(k===3?-0.06:0.12);return {date,open:close,high:close+2,low:close-2,close,volume:1000}})}));
}
test('all four paper competitors retain independent $5k ledgers and identical dates',()=>{
 const out=simulateTournament(fixtures());
 assert.equal(out.results.length,4);assert.equal(out.simulationOnly,true);
 assert.ok(out.sessions>=60);
 for(const r of out.results){
  assert.equal(r.curve.length,out.sessions);assert.equal(r.startingCash,5000);
  assert.ok(r.endingCash>=0);assert.ok(r.shares>=0);
  assert.equal(r.orders.every(o=>o.side==='buy'),true);
 }
});
test('prior close signals are never stamped on their own next-day fill',()=>{
 const result=simulateTournament(fixtures());
 for(const entry of result.results)for(const order of entry.orders){
  assert.ok(order.signalDate<order.day);
  assert.ok(order.fillPrice>=order.referencePrice);
 }
});
test('future close cannot alter past simulated trades',()=>{
 const original=fixtures();const before=simulateTournament(original);
 const modified=fixtures();
 for(const d of modified)for(const b of d.bars.slice(-1))b.close*=0.9;
 const after=simulateTournament(modified);
 for(let i=0;i<4;i++)assert.deepEqual(after.results[i].orders,before.results[i].orders);
});
test('unsorted bars, missing symbol and short history fail closed',()=>{
 const inputs=fixtures();assert.throws(()=>simulateTournament(inputs.slice(0,3)),/Archive/);
 const bad=fixtures();bad[0].bars[1].date=bad[0].bars[0].date;
 assert.throws(()=>simulateTournament(bad),/OHLCV/);
 const short=fixtures();short[0].bars=short[0].bars.slice(0,5);
 assert.throws(()=>simulateTournament(short),/at least 60/);
});
test('no cash borrowing and absent fake intraday fills',()=>{
 const result=simulateTournament(fixtures());
 for(const entry of result.results)for(const point of entry.curve)assert.ok(point.cash>=0);
 assert.ok(result.limitations.some(x=>x.includes('no intraday')));
});
