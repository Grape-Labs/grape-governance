const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('@babel/core');
const bs58 = require('bs58');
const filename = 'src/Governance/Demo/voteSigner.ts';
const loaded = { exports: {} };
new Function('module', 'exports', 'require', transformSync(fs.readFileSync(filename, 'utf8'), {
 filename, configFile:false, babelrc:false, presets:['@babel/preset-typescript'], plugins:['@babel/plugin-transform-modules-commonjs'],
}).code)(loaded, loaded.exports, id => id === '../Treasury/requestQueue' ? { treasuryRpcRequest: (_, fn) => fn() } : require(id));
const { findVoteSigner, lookupVoteSigner } = loaded.exports;
const proposal = '11111111111111111111111111111111';
const record = 'So11111111111111111111111111111111111111112';
const instruction = (authority = 'delegate', code = 13) => ({programId:'program', data:bs58.encode(Buffer.from([code])), accounts:['realm','governance',proposal,'proposer','ownerRecord',authority,record,'mint','payer']});
const transaction = instructions => ({meta:{err:null},transaction:{message:{instructions}}});
test('uses CastVote authority rather than fee payer for owner and delegate votes', () => {
 for (const signer of ['owner', 'delegate']) assert.equal(findVoteSigner(transaction([instruction(signer)]), 'program', proposal, record), signer);
});
test('ignores relinquish instructions, other records/programs, and failed transactions', () => {
 assert.equal(findVoteSigner(transaction([instruction('owner', 15)]), 'program', proposal, record), null);
 assert.equal(findVoteSigner(transaction([instruction()]), 'wrong', proposal, record), null);
 assert.equal(findVoteSigner(transaction([instruction()]), 'program', proposal, 'other'), null);
 const tx = transaction([instruction()]); tx.meta.err = {InstructionError:[]};
 assert.equal(findVoteSigner(tx, 'program', proposal, record), null);
});
test('supports CPI authority and selects the last matching cast in a transaction', () => {
 const tx = transaction([]); tx.meta.innerInstructions = [{instructions:[instruction('old'),instruction('delegate')]}];
 assert.equal(findVoteSigner(tx, 'program', proposal, record), 'delegate');
});
test('finds the latest cast before relinquishment, skipping failed transactions', async () => {
 const rpc = {getAccountInfo:async()=>({owner:'program'}),getSignaturesForAddress:async()=>[
  {signature:'failed',err:true},{signature:'relinquish'},{signature:'cast'},{signature:'older'},
 ],getParsedTransaction:async sig => transaction([instruction('delegate',sig==='relinquish'?15:13)])};
 assert.deepEqual(await lookupVoteSigner(rpc,proposal,record),{address:'delegate',signature:'cast'});
});
test('missing newer history never falls back to a potentially stale signer', async () => {
 const rpc = {getAccountInfo:async()=>({owner:'program'}),getSignaturesForAddress:async()=>[{signature:'missing'},{signature:'old'}],getParsedTransaction:async()=>null};
 assert.equal(await lookupVoteSigner(rpc,proposal,record),null);
});
