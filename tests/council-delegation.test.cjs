const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {transformSync}=require('@babel/core');
const sdk=require('@solana/spl-governance');
const {PublicKey,Keypair}=require('@solana/web3.js');
function load(file,mocks={}) {
 const m={exports:{}};
 new Function('module','exports','require',transformSync(fs.readFileSync(file,'utf8'),{filename:file,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code)(m,m.exports,id=>id in mocks?mocks[id]:require(id));
 return m.exports;
}
const policy=load('src/Governance/Demo/councilDelegationPolicy.ts');
const pk=()=>Keypair.generate().publicKey;
const owner=pk(), delegate=pk(), community=pk(), council=pk(), realmPk=pk(), outsider=pk();
const realm={pubkey:realmPk,owner:pk(),account:{communityMint:community,config:{councilMint:council}}};
const record=(wallet,mint=council,amount='1',recipient=null,realmAddress=realmPk)=>({pubkey:pk(),account:{realm:realmAddress,governingTokenMint:mint,governingTokenOwner:wallet,governingTokenDepositAmount:amount,governanceDelegate:recipient}});
const rows=[record(owner,council,'1',delegate),record(delegate,community)];
test('access allows deposited council owners and their delegates only',()=>{
 assert.equal(policy.councilDelegationAccess(realm,rows,owner.toBase58()).allowed,true);
 const access=policy.councilDelegationAccess(realm,rows,delegate.toBase58());
 assert.equal(access.allowed,true);assert.equal(access.owned.length,0);assert.equal(access.incoming.length,1);
 for(const wallet of ['',outsider.toBase58()]) assert.equal(policy.councilDelegationAccess(realm,rows,wallet).allowed,false);
 assert.equal(policy.councilDelegationAccess(realm,[record(owner,community,'10',delegate)],delegate.toBase58()).allowed,false);
 assert.equal(policy.councilDelegationAccess(realm,[record(owner,council,'0',delegate)],delegate.toBase58()).allowed,false);
 assert.equal(policy.councilDelegationAccess(realm,[record(owner,council,'1',delegate,pk())],delegate.toBase58()).allowed,false);
 assert.equal(policy.councilDelegationAccess({...realm,account:{config:{}}},rows,owner.toBase58()).allowed,false);
});
test('recipient membership excludes empty, unrelated-mint, and other-realm records',()=>{
 assert.deepEqual(policy.councilDelegationMembers(realm,[record(delegate,community),record(delegate,council),record(outsider,community,'0'),record(outsider,pk()),record(outsider,council,'1',null,pk())]),[delegate.toBase58()]);
});
function service({records=rows,verified=true,reputation=true,chainError=null}={}) {
 let checks=0;
 const connection={getLatestBlockhash:async()=>({blockhash:pk().toBase58(),lastValidBlockHeight:123}),confirmTransaction:async()=>({value:{err:chainError}})};
 const api=load('src/Governance/Demo/councilDelegation.ts',{
  '@solana/spl-governance':{...sdk,getRealm:async()=>realm,getAllTokenOwnerRecords:async()=>records},
  '../../utils/grapeTools/constants':{RPC_CONNECTION:connection},
  '../../utils/grapeTools/helpers':{getGrapeGovernanceProgramVersion:async()=>3},
  '../api/grapeProposalEligibility':{getGrapeProposalEligibility:async()=>{checks++;return {verification:{passed:verified,message:'verification'},reputation:{passed:reputation,message:'reputation'}};}},
  './councilDelegationPolicy':policy,
 });
 return {...api,checks:()=>checks};
}
test('transaction changes only council record and requires the council owner signature',async()=>{
 const api=service();const {transaction,blockhash}=await api.prepareCouncilDelegation(realmPk.toBase58(),owner.toBase58(),delegate.toBase58());
 assert.equal(transaction.instructions.length,1);
 const ix=transaction.instructions[0];
 assert.equal(ix.keys[0].pubkey.toBase58(),owner.toBase58());assert.equal(ix.keys[0].isSigner,true);
 const expected=await sdk.getTokenOwnerRecordAddress(realm.owner,realmPk,council,owner);
 assert.equal(ix.keys[1].pubkey.toBase58(),expected.toBase58());
 assert.equal(ix.data[0],sdk.GovernanceInstruction.SetGovernanceDelegate);
 assert.equal(ix.data[1],1);assert.deepEqual(ix.data.subarray(2),delegate.toBuffer());
 assert.equal(transaction.recentBlockhash,blockhash.blockhash);assert.equal(api.checks(),1);
});
test('delegate cannot redelegate; recipient requires membership, verification and reputation',async()=>{
 await assert.rejects(service().prepareCouncilDelegation(realmPk.toBase58(),delegate.toBase58(),owner.toBase58()),/Only the council token owner/);
 await assert.rejects(service().prepareCouncilDelegation(realmPk.toBase58(),owner.toBase58(),outsider.toBase58()),/existing DAO member/);
 await assert.rejects(service().prepareCouncilDelegation(realmPk.toBase58(),owner.toBase58(),owner.toBase58()),/Choose another/);
 for(const opts of [{verified:false},{reputation:false}]) await assert.rejects(service(opts).prepareCouncilDelegation(realmPk.toBase58(),owner.toBase58(),delegate.toBase58()));
});
test('revocation does not require the old delegate to remain eligible',async()=>{
 const api=service({verified:false,reputation:false});
 const {transaction}=await api.prepareCouncilDelegation(realmPk.toBase58(),owner.toBase58(),null);
 assert.equal(transaction.instructions[0].data[1],0);assert.equal(api.checks(),0);
});
test('failed on-chain confirmation is not reported as success',async()=>{
 await assert.rejects(service({chainError:{InstructionError:[]}}).confirmCouncilDelegation('sig',{blockhash:'block',lastValidBlockHeight:1}),/failed on chain/);
});
