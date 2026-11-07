import test from 'node:test';
import assert from 'node:assert/strict';
import {compareShadowMarks,simulateShadowBuy,valueShadowBook} from '../lib/arena-evolution.ts';
test('unpaired or short shadow windows cannot pass promotion gate',()=>{
 const marks=Array.from({length:19},(_,i)=>({day:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),baselineEquity:5000,candidateEquity:5100}));
 assert.equal(compareShadowMarks(marks).eligible,false);
});
test('improvement with greater drawdown than baseline is rejected',()=>{
 const marks=Array.from({length:21},(_,i)=>({day:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),baselineEquity:5000+i,candidateEquity:i===8?4200:5000+i*2}));
 assert.equal(compareShadowMarks(marks).eligible,false);
});
test('paired candidate with better return and controlled drawdown passes mechanical gate only',()=>{
 const marks=Array.from({length:21},(_,i)=>({day:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),baselineEquity:5000+i,candidateEquity:5000+i*2}));
 const gate=compareShadowMarks(marks);
 assert.equal(gate.eligible,true);assert.equal(gate.pairedSessions,21);
});
test('paper positions use distinct independent books and respect starting notional caps',()=>{
 const starting={cash:5000,positions:{}};
 const b=simulateShadowBuy(starting,'NVDA',100,0.2);
 const c=simulateShadowBuy(starting,'NVDA',100,0.1);
 assert.ok(b.fill&&c.fill);
 assert.notEqual(b.fill!.shares,c.fill!.shares);
 assert.equal(starting.cash,5000);assert.deepEqual(starting.positions,{});
 assert.ok((b.fill?.total??Infinity)<=1000);
 assert.equal(valueShadowBook(b.book,{NVDA:100}),Number((b.book.cash+b.fill!.shares*100).toFixed(4)));
 assert.equal(valueShadowBook(b.book,{}),null);
});
