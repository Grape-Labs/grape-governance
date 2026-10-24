const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {transformSync}=require('@babel/core');
const {Keypair}=require('@solana/web3.js');
const gov=require('@solana/spl-governance');
const pk=()=>Keypair.generate().publicKey;
let calls=[], pluginCalls=[], config=null, reads=0;
const plugin=pk();
function load(file, resolver) {
 const m={exports:{}};
 const code=transformSync(fs.readFileSync(file,'utf8'),{filename:file,configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 new Function('module','exports','require','console',code)(m,m.exports,resolver,{log(){}});
 return m.exports;
}
const rules=load('src/utils/governanceTools/ballotRules.ts',require);
const connection={getLatestBlockhash:async()=>({blockhash:pk().toBase58()}),getRecentPrioritizationFees:async()=>[],getAccountInfo:async()=>({})};
const {createCastVoteTransaction:cast}=load('src/utils/governanceTools/components/instructions/createVote.ts',id=>{
 if(id==='../../ballotRules')return rules;
 if(id==='./client')return {VSR_PLUGIN_PKS:[plugin.toBase58()]};
 if(id==='@solana/spl-governance')return {...gov,tryGetRealmConfig:async()=>{reads++;return config;},withCastVote:async(...args)=>{calls.push(args);return gov.withCastVote(...args);}};
 if(id.endsWith('/constants'))return {RPC_CONNECTION:connection,DEFAULT_PRIORITY_RATE:1};
 if(id.endsWith('/helpers'))return {getGrapeGovernanceProgramVersion:async()=>3};
 if(id==='./getVotePlugin')return {getVotingPluginWithUpdate:async(...args)=>{pluginCalls.push(args);return {voterWeightPk:pk(),instructions:[]};}};
 if(id==='../../stakingVoterPlugin')return {isStakingVoterPlugin:()=>false};
 if(['./account','@coral-xyz/anchor','@solana/governance-program-library/dist'].includes(id))return {};
 return require(id);
});
const realm={pubkey:pk(),owner:pk(),account:{config:{}}};
const wallet=pk(),owner=pk();
const tor={pubkey:pk(),account:{governingTokenOwner:owner}};
const account={options:[{label:'A'},{label:'B'}],voteType:{type:1,choiceType:1,minVoterOptions:1,maxVoterOptions:2},denyVoteWeight:'0'};
const data={proposal:{...account,proposalId:pk(),governanceId:pk(),governingTokenMint:pk(),tokenOwnerRecord:pk()}};
test('transaction encodes every weighted choice and retains delegated owner and signing authority',async()=>{
 calls=[]; config=null;
 await cast(realm,wallet,data,tor,owner.toBase58(),true,{proposal:{account},weights:[35,65]},0);
 const args=calls.at(-1);
 assert.deepEqual(args[10].approveChoices.map(x=>x.weightPercentage),[35,65]);
 assert.equal(args[8].toBase58(),wallet.toBase58());
 assert.equal(args[7].toBase58(),tor.pubkey.toBase58());
 assert.equal(args[9].toBase58(),data.proposal.governingTokenMint.toBase58());
});
test('invalid ballots and poll denial stop before RPC or transaction construction',async()=>{
 calls=[];reads=0;
 await assert.rejects(cast(realm,wallet,data,tor,null,true,{proposal:{account},weights:[35,64]},0),/100%/);
 await assert.rejects(cast(realm,wallet,{proposal:{...data.proposal,denyVoteWeight:null}},tor,null,true,null,1),/does not allow Against/);
 assert.equal(reads,0);assert.equal(calls.length,0);
});
test('council plugin uses council config and the voting owner rather than the delegate signer',async()=>{
 calls=[];pluginCalls=[];
 config={account:{communityTokenConfig:{voterWeightAddin:pk()},councilTokenConfig:{voterWeightAddin:plugin}}};
 await cast(realm,wallet,data,tor,owner.toBase58(),false,{proposal:{account},weights:[0,100]},0);
 assert.equal(pluginCalls[0][2].toBase58(),owner.toBase58());
 assert.equal(pluginCalls[0][3].toBase58(),plugin.toBase58());
 assert.ok(calls[0][12]);
});
test('unsupported plugins stop before a vote is built; veto uses the canonical vote kind',async()=>{
 calls=[];config={account:{communityTokenConfig:{voterWeightAddin:pk()}}};
 await assert.rejects(cast(realm,wallet,data,tor,null,true,null,0),/does not support/);
 assert.equal(calls.length,0);
 config=null;
 await cast(realm,wallet,data,tor,null,false,null,3);
 assert.equal(calls[0][10].voteType,gov.VoteKind.Veto);
 assert.equal(calls[0][10].veto,true);
});
