import {test} from 'node:test';
import assert from 'node:assert/strict';
import {votingPowerDrop,netTransferEvents} from '../src/Governance/Members/reviewSummary.js';
test('screenshot shows the recent 247473.88224 decline rather than oldest-to-newest growth',()=>{
 const votes=[{record:'new',weight:'4052743.03639'},{record:'peak',weight:'4300216.91863'},{record:'old',weight:'3832383.18863'}];
 const result=votingPowerDrop(votes,'4052743.03639');
 assert.equal(result.reference.record,'peak');
 assert.equal(result.difference,'247473.88224');
 assert.ok(Math.abs(Number(result.percent)-5.754916254)<0.00001);
});
test('300k out of 4.3m is below 10 percent; selected references override the peak',()=>{
 const votes=[{record:'high',weight:'5000000'},{record:'chosen',weight:'4300000'}];
 const result=votingPowerDrop(votes,'4000000','chosen');
 assert.equal(result.difference,'300000');
 assert.ok(Number(result.percent)<7);
 assert.equal(votingPowerDrop(votes,null),null);
 assert.equal(votingPowerDrop(votes,'4000000','missing'),null);
});
test('a roundtrip displays only the net amount without changing swaps',()=>{
 const rows=netTransferEvents([
 {signature:'a',type:'incoming',amount:'4182743.03639',timestamp:1},
 {signature:'a',type:'transfer',amount:'4052743.03639',timestamp:1},
 {signature:'b',type:'swap',amount:'130000',timestamp:2},
 ]);
 assert.equal(rows[0].type,'swap');
 assert.equal(rows[1].amount,'130000');
 assert.equal(rows[1].type,'incoming');
 assert.equal(rows[1].grossOutgoing,'4052743.03639');
});
test('zero-net and independent transactions are not combined into a claimed sale',()=>{
 const rows=netTransferEvents([
 {signature:'a',type:'incoming',amount:'100',timestamp:1},
 {signature:'a',type:'transfer',amount:'100',timestamp:1},
 {signature:'b',type:'transfer',amount:'50',timestamp:2},
 ]);
 assert.equal(rows[1].type,'roundtrip');
 assert.equal(rows[1].amount,'0');
 assert.equal(rows[0].amount,'50');
});
