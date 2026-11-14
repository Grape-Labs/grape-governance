const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {transformSync}=require('@babel/core');
const {Keypair,StakeProgram,StakeInstruction,SystemInstruction,SystemProgram}=require('@solana/web3.js');
function load(path){const mod={exports:{}};new Function('require','module','exports',transformSync(fs.readFileSync(path,'utf8'),{filename:path,configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code)(require,mod,mod.exports);return mod.exports;}
const {buildTreasuryStake,buildTreasurySplitDeactivate,assertTreasuryStakeAuthority,singleStakeInstruction}=load('src/Governance/Treasury/plugins/treasuryStakeSafety.ts');
const {queuedInstructionGroups}=load('src/Governance/Treasury/queuedInstructionGroups.ts');
const treasury=Keypair.generate().publicKey,source=Keypair.generate().publicKey,vote=Keypair.generate().publicKey,attacker=Keypair.generate().publicKey;
const conn=(withdrawer=treasury,staker=treasury)=>({getAccountInfo:async()=>null,getMinimumBalanceForRentExemption:async()=>2282880,getParsedAccountInfo:async()=>({value:{owner:StakeProgram.programId,data:{parsed:{info:{meta:{authorized:{withdrawer:withdrawer?.toBase58(),staker:staker.toBase58()}}}}}}})});
test('new stake retains both authorities and seed ownership at the treasury',async()=>{
 const ixs=await buildTreasuryStake(conn(),treasury,'safe-seed',1e9,vote);
 const create=SystemInstruction.decodeCreateWithSeed(ixs[0]);
 assert.ok(create.fromPubkey.equals(treasury));assert.ok(create.basePubkey.equals(treasury));assert.ok(create.programId.equals(StakeProgram.programId));
 const initialize=StakeInstruction.decodeInitialize(ixs[1]);
 assert.ok(initialize.authorized.staker.equals(treasury));assert.ok(initialize.authorized.withdrawer.equals(treasury));
 const delegate=StakeInstruction.decodeDelegate(ixs[2]);assert.ok(delegate.authorizedPubkey.equals(treasury));assert.ok(delegate.votePubkey.equals(vote));
 const queue=[{payload:{ix:ixs,proposalInstructionChunkBy:3}}];assert.deepEqual(queuedInstructionGroups(queue,x=>x),[ixs]);
});
test('rejects existing derived accounts and externally controlled source stake',async()=>{
 await assert.rejects(buildTreasuryStake({...conn(),getAccountInfo:async()=>({owner:StakeProgram.programId})},treasury,'seed',1e9,vote),/already exists/);
 await assert.rejects(assertTreasuryStakeAuthority(conn(attacker),source,treasury,true),/withdrawal authority/);
 await assert.rejects(assertTreasuryStakeAuthority(conn(null),source,treasury),/withdrawal authority/);
 await assert.rejects(assertTreasuryStakeAuthority(conn(treasury,attacker),source,treasury,true),/stake authority/);
 await assert.rejects(assertTreasuryStakeAuthority({...conn(),getParsedAccountInfo:async()=>({value:{owner:SystemProgram.programId}})},source,treasury),/Stake Program/);
});
test('partial unstake contains a real Split between creation and deactivation',async()=>{
 const ixs=await buildTreasurySplitDeactivate(conn(),treasury,source,'split-seed',1e9);
 assert.equal(ixs.length,4);const guard=StakeInstruction.decodeAuthorize(ixs[0]);assert.ok(guard.authorizedPubkey.equals(treasury));assert.ok(guard.newAuthorizedPubkey.equals(treasury));assert.equal(guard.stakeAuthorizationType.index,1);const create=SystemInstruction.decodeCreateWithSeed(ixs[1]);const split=StakeInstruction.decodeSplit(ixs[2]);const deactivate=StakeInstruction.decodeDeactivate(ixs[3]);
 assert.ok(create.basePubkey.equals(treasury));assert.ok(split.authorizedPubkey.equals(treasury));assert.ok(split.stakePubkey.equals(source));assert.ok(split.splitStakePubkey.equals(create.newAccountPubkey));assert.ok(deactivate.stakePubkey.equals(create.newAccountPubkey));
 assert.deepEqual(queuedInstructionGroups([{payload:{ix:ixs,proposalInstructionChunkBy:4}}],x=>x),[ixs]);
 assert.throws(()=>singleStakeInstruction(StakeProgram.split({stakePubkey:source,authorizedPubkey:treasury,splitStakePubkey:attacker,lamports:1e9},2282880)),/discard instructions/);
});
test('all withdrawal builders target treasury, with no authority reassignment instruction',()=>{
 const text=fs.readFileSync('src/Governance/Treasury/plugins/StakeValidatorView.tsx','utf8');
 assert.equal((text.match(/StakeProgram.withdraw\(/g)||[]).length,2);
 assert.match(text,/toPubkey: nativeWalletPubkey/);assert.match(text,/toPubkey: govWallet/);
 assert.ok(!text.includes('StakeProgram.authorize('));
});
test('existing inactive stake delegates atomically with unchanged treasury withdrawer',async()=>{
 const {buildTreasuryDelegateExisting}=load('src/Governance/Treasury/plugins/treasuryStakeSafety.ts');
 const {VoteProgram}=require('@solana/web3.js');
 const rpc={...conn(),getStakeActivation:async()=>({state:'inactive'}),getAccountInfo:async()=>({owner:VoteProgram.programId})};
 const ixs=await buildTreasuryDelegateExisting(rpc,treasury,source,vote);
 assert.equal(ixs.length,2);const guard=StakeInstruction.decodeAuthorize(ixs[0]);const delegate=StakeInstruction.decodeDelegate(ixs[1]);
 assert.ok(guard.newAuthorizedPubkey.equals(treasury));assert.ok(guard.authorizedPubkey.equals(treasury));assert.equal(guard.stakeAuthorizationType.index,1);
 assert.ok(delegate.stakePubkey.equals(source));assert.ok(delegate.votePubkey.equals(vote));assert.ok(delegate.authorizedPubkey.equals(treasury));
 assert.deepEqual(queuedInstructionGroups([{payload:{ix:ixs,proposalInstructionChunkBy:ixs.length}}],x=>x),[ixs]);
 for(const state of ['active','activating','deactivating']) await assert.rejects(buildTreasuryDelegateExisting({...rpc,getStakeActivation:async()=>({state})},treasury,source,vote),/fully inactive/);
 await assert.rejects(buildTreasuryDelegateExisting({...rpc,getStakeActivation:async()=>{throw new Error('offline');}},treasury,source,vote),/Cannot verify/);
 await assert.rejects(buildTreasuryDelegateExisting({...rpc,getAccountInfo:async()=>({owner:SystemProgram.programId})},treasury,source,vote),/native vote account/);
});
test('atomic stake groups fit one governance execute transaction',async()=>{
 const {TransactionMessage,VersionedTransaction}=require('@solana/web3.js');
 const {withExecuteTransaction,createInstructionData}=require('@solana/spl-governance');
 const {buildTreasuryDelegateExisting}=load('src/Governance/Treasury/plugins/treasuryStakeSafety.ts');
 const {VoteProgram}=require('@solana/web3.js');
 const rpc={...conn(),getStakeActivation:async()=>({state:'inactive'}),getAccountInfo:async()=>({owner:VoteProgram.programId})};
 const groups=[await buildTreasuryStake(conn(),treasury,'atomic-size',1e9,vote),await buildTreasurySplitDeactivate(conn(),treasury,source,'atomic-split',1e9),await buildTreasuryDelegateExisting(rpc,treasury,source,vote)];
 for(const group of groups){
  const execute=[];
  await withExecuteTransaction(execute,Keypair.generate().publicKey,3,Keypair.generate().publicKey,Keypair.generate().publicKey,Keypair.generate().publicKey,group.map(createInstructionData));
  assert.equal(execute.length,1);
  const message=new TransactionMessage({payerKey:Keypair.generate().publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58(),instructions:execute}).compileToV0Message();
  assert.ok(new VersionedTransaction(message).serialize().length<=1232);
 }
});
