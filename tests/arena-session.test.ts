import test from 'node:test';
import assert from 'node:assert/strict';
import {eligiblePaperQuote,easternSession} from '../lib/arena-session.ts';
test('market is not eligible on Saturdays and after-hours',()=>{
 assert.equal(eligiblePaperQuote(new Date('2026-11-07T16:00:00Z'),'2026-11-06').eligible,false);
 assert.equal(eligiblePaperQuote(new Date('2026-11-09T23:00:00Z'),'2026-11-09').eligible,false);
});
test('regular Monday Eastern session requires date-aligned quote',()=>{
 const now=new Date('2026-11-09T16:00:00Z');
 assert.equal(easternSession(now).open,true);
 assert.equal(eligiblePaperQuote(now,'2026-11-09 11:00:00').eligible,true);
 assert.equal(eligiblePaperQuote(now,'2026-11-06').eligible,false);
});
