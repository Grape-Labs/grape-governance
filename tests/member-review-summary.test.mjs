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

test('governance peak captures the 437473.88224 decline missing from vote-only references',async()=>{
 const {governancePositionDrop}=await import('../src/Governance/Members/reviewSummary.js');
 const result=governancePositionDrop([
 {id:'peak',signature:'peakTx',position:'4490216.91863'},
 {id:'later',signature:'laterTx',position:'4300216.91863'},
 {id:'now',signature:'nowTx',position:'4052743.03639'},
 ],'4052743.03639');
 assert.equal(result.difference,'437473.88224');
 assert.ok(Number(result.percent)>9.74 && Number(result.percent)<10);
 assert.equal(result.reference.source,'governance');
 assert.equal(governancePositionDrop(null,'4052743.03639'),null);
});
test('governance peak excludes temporary intra-transaction positions',async()=>{
 const {governancePositionDrop}=await import('../src/Governance/Members/reviewSummary.js');
 const result=governancePositionDrop([
 {id:'a',signature:'one',position:'1000'},
 {id:'b',signature:'one',position:'100'},
 {id:'c',signature:'two',position:'90'},
 ],'90');
 assert.equal(result.reference.weight,'100');
 assert.equal(result.difference,'10');
});

test('earlier reductions remain visible after later deposits restore position',async()=>{
 const {governanceReductionHistory}=await import('../src/Governance/Members/reviewSummary.js');
 const row=(id,date,position)=>({id,signature:id,timestamp:Date.parse(date)/1000,position});
 const result=governanceReductionHistory([
 row('peak','2026-05-17','10225181.62'),
 row('withdraw','2026-06-04T01:00:00Z','0'),
 row('restore','2026-06-04T02:00:00Z','10225181.62'),
 row('withdraw2','2026-06-04T03:00:00Z','0'),
 row('redeposit','2026-06-04T04:00:00Z','5225181.62'),
 row('grant','2026-08-18','7666924.7'),
 row('out','2026-08-19T01:00:00Z','0'),
 row('back','2026-08-19T02:00:00Z','5746924.7'),
 row('now','2026-09-09','7987446.882801'),
 ],'7987446.882801');
 assert.equal(result.cumulative,'6920000');
 assert.equal(result.drawdown,'5000000');
 assert.ok(Number(result.drawdownPercent)<50);
 assert.ok(Number(result.cumulativePercent)>67);
 assert.equal(result.reductions.length,2);
});
