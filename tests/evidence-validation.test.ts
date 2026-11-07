import test from 'node:test';
import assert from 'node:assert/strict';
import {assessEvidence} from '../lib/evidence-validation.ts';
const sources=[{id:'S1',url:'https://www.sec.gov/Archives/edgar/data/1/000000000000000001/test.htm',date:'2026-08-21',label:'10-Q'},
 {id:'S2',url:'https://twelvedata.com',date:'2026-11-06',label:'Price source'}];
test('valid source ID citations pass structural checks',()=>{
 const x=assessEvidence('Reported revenue grew [S1]. Historical vol was 22% [S2].',sources);
 assert.equal(x.passesStructuralGate,true);
 assert.equal(x.distinctCitedSources,2);
 assert.equal(x.citationCoverage,1);
});
test('rejects missing citations, inventing a source, and no retrieved sources',()=>{
 assert.equal(assessEvidence('This is a plain answer.',sources).passesStructuralGate,false);
 assert.equal(assessEvidence('A statement [S9]',sources).passesStructuralGate,false);
 assert.equal(assessEvidence('A statement [S1]',[]).passesStructuralGate,false);
});
test('does not confuse source S1 with S10',()=>{
 const x=assessEvidence('A claim [S10]',sources);
 assert.deepEqual(x.unknownIds,['S10']);
});
