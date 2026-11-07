import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveResearchSymbol} from '../lib/symbol-resolution.ts';

test('recognizes NVIDIA in the exact user phrasing',()=>{
 assert.equal(resolveResearchSymbol('Analyze NVIDIA Volatility'),'NVDA');
 assert.equal(resolveResearchSymbol('Why is Nvidia more volatile?'),'NVDA');
 assert.equal(resolveResearchSymbol('historical drawdown for nvidia corporation'),'NVDA');
});
test('supports aliases for other major US companies',()=>{
 assert.equal(resolveResearchSymbol('Analyze Microsoft volatility'),'MSFT');
 assert.equal(resolveResearchSymbol('show the Apple price'),'AAPL');
 assert.equal(resolveResearchSymbol('What happened to Alphabet?'),'GOOGL');
});
test('explicit ticker takes precedence over company aliases',()=>{
 assert.equal(resolveResearchSymbol('Compare $AMD with NVIDIA'),'AMD');
 assert.equal(resolveResearchSymbol('How volatile is NVDA?'),'NVDA');
 assert.equal(resolveResearchSymbol('What about $BRK.B?'),'BRK.B');
});
test('does not match company tokens embedded in unrelated words',()=>{
 assert.equal(resolveResearchSymbol('Analyze METADATA normalization'),null);
 assert.equal(resolveResearchSymbol('Give me portfolio risk exposure'),null);
 assert.equal(resolveResearchSymbol('Tell me about instability'),null);
});
