import test from 'node:test';
import assert from 'node:assert/strict';
import {deterministicStage,decideStudioOutcome,knownCitations,type StudioEvidence,type RoleOutput} from '../lib/arena-operations.ts';
const records:StudioEvidence[]=[
 {id:'E1',label:'Quote',value:'100 USD',asOf:'2026-11-06',source:'Test',url:null,available:true},
 {id:'E2',label:'Momentum',value:'5%',asOf:'2026-11-05',source:'Test',url:null,available:true},
 {id:'E3',label:'Volatility',value:'Unavailable',asOf:null,source:'Test',url:null,available:false}
];
function role(stage:'strategy'|'critic'|'risk',vote:RoleOutput['vote']):RoleOutput{
 return {...deterministicStage(stage,records,'AI infrastructure'),vote,durationMs:1};
}
test('citations only reference available actual evidence',()=>assert.deepEqual(knownCitations(['E1','E3','E1','FABRICATED'],records),['E1']));
test('a risk veto forces abstention regardless of enthusiastic thesis',()=>{
 const d=decideStudioOutcome([role('strategy','support'),role('critic','observe'),role('risk','veto')],2);
 assert.equal(d.verdict,'abstain');assert.equal(d.veto,true);
});
test('unanswered critic challenge prevents consider outcome',()=>{
 const d=decideStudioOutcome([role('strategy','support'),role('critic','challenge'),role('risk','observe')],2);
 assert.equal(d.verdict,'hold');
});
test('even a supported debate only proposes consideration, never execution',()=>{
 const d=decideStudioOutcome([role('strategy','support'),role('critic','observe'),role('risk','observe')],2);
 assert.equal(d.verdict,'consider');assert.equal(d.veto,false);
});
test('research mode explicitly indicates limited evidence',()=>{
 const r=deterministicStage('research',records.slice(2),'AI');
 assert.equal(r.status,'limited');assert.equal(r.mode,'rules');
});
