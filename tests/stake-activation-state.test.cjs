const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {transformSync}=require('@babel/core');
const {Keypair,StakeProgram}=require('@solana/web3.js');
const mod={exports:{}};
new Function('require','module','exports',transformSync(fs.readFileSync('src/utils/grapeTools/stakeAccounts.ts','utf8'),{filename:'stakeAccounts.ts',configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code)(require,mod,mod.exports);
const {fetchStakeAccountsByAuthorityRpc}=mod.exports;
const authority=Keypair.generate().publicKey,address=Keypair.generate().publicKey;
const row=(type='delegated',deactivationEpoch='18446744073709551615')=>({pubkey:address,account:{lamports:10002282880,data:{parsed:{type,info:{meta:{rentExemptReserve:2282880,authorized:{staker:authority.toBase58(),withdrawer:authority.toBase58()}},...(type==='delegated'?{stake:{delegation:{stake:'10000000000',deactivationEpoch,voter:Keypair.generate().publicKey.toBase58()}}}:{})}}}}});
const conn=(record,activation)=>({getParsedProgramAccounts:async()=>[record],getStakeActivation:async()=>activation});
test('reads actual RPC parsed.type rather than nonexistent info.type',async()=>{
 const results=await fetchStakeAccountsByAuthorityRpc(conn(row(),{state:'active',active:1e10,inactive:0}),authority);
 assert.equal(results.length,1);assert.equal(results[0].state,'active');assert.equal(results[0].status,'delegated');assert.equal(results[0].activationVerified,true);
 assert.equal(results[0].activeStakeLamports,1e10);assert.equal(results[0].withdrawer,authority.toBase58());
});
test('runtime inactive overrides stale delegated principal after cooldown',async()=>{
 const [result]=await fetchStakeAccountsByAuthorityRpc(conn(row('delegated','123'),{state:'inactive',active:0,inactive:1e10}),authority);
 assert.equal(result.state,'inactive');assert.equal(result.activeStakeLamports,0);assert.equal(result.inactiveLamports,1e10);
});
test('unavailable runtime lookup never guesses fully inactive from epoch age',async()=>{
 const [result]=await fetchStakeAccountsByAuthorityRpc({...conn(row('delegated','1')),getStakeActivation:async()=>{throw new Error('method unavailable');}},authority);
 assert.equal(result.state,'deactivating');assert.equal(result.activationVerified,false);assert.equal(result.activeStakeLamports,1e10);
 const [active]=await fetchStakeAccountsByAuthorityRpc({...conn(row()),getStakeActivation:async()=>{throw new Error('offline');}},authority);
 assert.equal(active.state,'delegated');assert.equal(active.activationVerified,false);
});
test('initialized stake is inactive without requiring a runtime endpoint',async()=>{
 const [result]=await fetchStakeAccountsByAuthorityRpc({getParsedProgramAccounts:async()=>[row('initialized')]},authority);
 assert.equal(result.state,'inactive');assert.equal(result.activationVerified,true);
});
