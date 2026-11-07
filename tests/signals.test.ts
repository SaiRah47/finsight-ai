import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSignals} from '../lib/signals.ts';
import type {PriceBar} from '../lib/market';

function fixture(n:number,price:(i:number)=>number,volume:(i:number)=>number=()=>100):PriceBar[]{
 const first=Date.UTC(2025,0,1);
 return Array.from({length:n},(_,i)=>({
  date:new Date(first+i*86400000).toISOString().slice(0,10),
  open:price(i),high:price(i),low:price(i),close:price(i),volume:volume(i)
 }));
}
const metric=(n:string,r:ReturnType<typeof calculateSignals>)=>r.metrics.find(x=>x.id===n)!;

test('insufficient history produces no fabricated score',()=>{
 const r=calculateSignals('TEST',fixture(8,()=>100));
 assert.equal(r.attentionScore,null);
 assert.equal(metric('momentum20',r).value,null);
 assert.equal(metric('volatility20',r).value,null);
 assert.equal(metric('volumeRatio',r).value,null);
});
test('flat price series yields zero volatility and momentum',()=>{
 const r=calculateSignals('TEST',fixture(80,()=>100));
 assert.equal(metric('momentum20',r).value,0);
 assert.equal(metric('momentum60',r).value,0);
 assert.equal(metric('volatility20',r).value,0);
 assert.equal(metric('drawdown90',r).value,0);
 assert.equal(metric('volumeRatio',r).value,1);
 assert.equal(r.attentionScore,0);
});
test('steady rising series has positive momentum, zero max drawdown',()=>{
 const r=calculateSignals('TEST',fixture(90,i=>100+i));
 assert.ok((metric('momentum20',r).value??0)>0);
 assert.equal(metric('drawdown90',r).value,0);
});
test('falling price has negative momentum and nonzero drawdown',()=>{
 const r=calculateSignals('TEST',fixture(90,i=>200-i));
 assert.ok((metric('momentum20',r).value??0)<0);
 assert.ok((metric('drawdown90',r).value??0)<0);
});
test('relative volume compares final observation against preceding bars',()=>{
 const r=calculateSignals('TEST',fixture(80,()=>100,i=>i===79?300:100));
 assert.equal(metric('volumeRatio',r).value,3);
});
test('missing prior volumes do not fabricate relative volume or composite score',()=>{
 const r=calculateSignals('TEST',fixture(80,()=>100,i=>i>72?100:0));
 assert.equal(metric('volumeRatio',r).value,null);
 assert.equal(r.attentionScore,null);
});
test('score remains within 0–100 under extreme movements',()=>{
 const r=calculateSignals('TEST',fixture(100,i=>i%2===0?100:350,i=>i===99?50000:100));
 assert.ok(r.attentionScore!==null&&r.attentionScore>=0&&r.attentionScore<=100);
});
