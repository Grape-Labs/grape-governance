const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {transformSync}=require('@babel/core');
const gov=require('@solana/spl-governance');
const {serialize}=require('@solana/spl-governance/node_modules/borsh');
const BN=require('bn.js');
const mod={exports:{}};
new Function('module','exports','require',transformSync(fs.readFileSync('src/Governance/governanceConfigSummary.ts','utf8'),{filename:'summary.ts',configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code)(mod,mod.exports,require);
const {decodeGovernanceConfig,governanceConfigRows}=mod.exports;
test('decodes governance configuration layouts and formats settings without precision loss',()=>{
 const config=new gov.GovernanceConfig({communityVoteThreshold:new gov.VoteThreshold({type:0,value:4}),minCommunityTokensToCreateProposal:new BN('220000000000'),minInstructionHoldUpTime:0,baseVotingTime:428400,communityVoteTipping:2,councilVoteThreshold:new gov.VoteThreshold({type:0,value:50}),councilVetoVoteThreshold:new gov.VoteThreshold({type:0,value:50}),minCouncilTokensToCreateProposal:new BN('9007199254740993'),councilVoteTipping:0,communityVetoVoteThreshold:new gov.VoteThreshold({type:2}),votingCoolOffTime:3600,depositExemptProposalCount:10});
 for(const version of [1,2,3]){
  const bytes=serialize(gov.getGovernanceInstructionSchema(version),new gov.SetGovernanceConfigArgs({config}));
  const decoded=decodeGovernanceConfig(bytes);
  assert.ok(decoded);
  const rows=new Map(governanceConfigRows(decoded));
  assert.equal(rows.get('Community vote threshold'),'4%');
  assert.equal(rows.get('Voting period'),'4 days 23 hours');
  assert.equal(rows.get('Minimum council tokens to create a proposal (base units)'),'9007199254740993');
  if(version===3)assert.equal(rows.get('Voting cool-off time'),'1 hour');
 }
});
test('rejects unrelated and malformed instructions',()=>{
 for(const data of [[],[1,2,3],[19],[19,255]])assert.equal(decodeGovernanceConfig(Uint8Array.from(data)),null);
});
test('formats mint decimals exactly with readable separators',()=>{
 const {formatConfigTokenAmount}=mod.exports;
 assert.equal(formatConfigTokenAmount(new BN('220000000000'),6),'220,000');
 assert.equal(formatConfigTokenAmount(new BN('9007199254740993123'),6),'9,007,199,254,740.993123');
 assert.equal(formatConfigTokenAmount(new BN('1'),9),'0.000000001');
 assert.equal(formatConfigTokenAmount(new BN('1234'),0),'1,234');
 assert.equal(formatConfigTokenAmount(new BN('18446744073709551615'),6),'Disabled');
 assert.equal(formatConfigTokenAmount(new BN('220000000000')),'220000000000');
});

test('decodes SDK realm config layouts and resolves optional add-in accounts', () => {
 const {decodeRealmConfig, realmConfigRows, decodeConfigInstruction}=mod.exports;
 for (const version of [1,2,3]) {
  const tokenConfig = new gov.GoverningTokenConfigArgs({useVoterWeightAddin:true,useMaxVoterWeightAddin:false,tokenType:0});
  const configArgs = new gov.RealmConfigArgs({useCouncilMint:true,minCommunityTokensToCreateGovernance:new BN('72500000'),communityMintMaxVoteWeightSource:new gov.MintMaxVoteWeightSource({type:0,value:new BN('10000000000')}),useCommunityVoterWeightAddin:true,useMaxCommunityVoterWeightAddin:false,communityTokenConfigArgs:tokenConfig,councilTokenConfigArgs:tokenConfig});
  const bytes=serialize(gov.getGovernanceInstructionSchema(version),new gov.SetRealmConfigArgs({configArgs}));
  const decoded=decodeRealmConfig(bytes);
  assert.ok(decoded, `version ${version}`);
  assert.equal(decoded.version,version);
  assert.equal(decodeConfigInstruction(bytes).kind,'realm');
  const rows=new Map(realmConfigRows(decoded,{community:6},['realm','authority','council','holding','system','config','community-addin','council-addin']));
  assert.equal(rows.get('Minimum community tokens to create governance'),'72.5');
  assert.equal(rows.get('Community maximum vote weight'),'100% of supply');
  assert.equal(rows.get('Council mint'),'council');
  if(version>1) assert.equal(rows.get('Community voter weight add-in'),'community-addin');
  if(version===3) assert.equal(rows.get('Council voter weight add-in'),'council-addin');
  assert.equal(decodeRealmConfig(bytes.slice(0,-1)),null);
 }
 assert.equal(decodeRealmConfig(Uint8Array.from([19])),null);
});

test('realm summaries handle no council, sparse add-ins, absolute weights and invalid enums', () => {
 const {decodeRealmConfig,realmConfigRows}=mod.exports;
 const data=Buffer.alloc(25);
 data[0]=22;
 data[10]=1; // absolute maximum weight
 data.writeBigUInt64LE(9007199254740993n,11);
 data[20]=1; // community max voter weight add-in only
 data[21]=2; // dormant community token
 data[24]=1; // membership council token
 const config=decodeRealmConfig(data);
 const rows=new Map(realmConfigRows(config,{},['realm','authority','system','config','max-addin']));
 assert.equal(rows.get('Council mint'),'Disabled');
 assert.equal(rows.get('Community maximum vote weight'),'9007199254740993 (absolute weight)');
 assert.equal(rows.get('Community voter weight add-in'),'Disabled');
 assert.equal(rows.get('Community max voter weight add-in'),'max-addin');
 assert.equal(rows.get('Community token type'),'Dormant');
 for (const offset of [1,10,19,20,21,22,23,24]) {
  const invalid=Buffer.from(data); invalid[offset]=255;
  assert.equal(decodeRealmConfig(invalid),null);
 }
});

test('compares values without treating unknown baselines as changes', () => {
 const {compareConfigRows}=mod.exports;
 assert.deepEqual(compareConfigRows([['Threshold','4%'],['Tipping','Disabled'],['Missing','1'],['Unknown','Unavailable']], [['Threshold','5%'],['Tipping','Disabled'],['Unknown','2']]).map(r=>r.changed),[true,false,null,null]);
 assert.equal(compareConfigRows([['Threshold','4%']])[0].changed,null);
});

test('compares realm account state with proposed token settings and council removal', () => {
 const {currentRealmConfigRows,realmConfigRows,compareConfigRows}=mod.exports;
 const pk = value => ({toBase58:()=>value});
 const current = {councilMint:pk('council'),minCommunityTokensToCreateGovernance:new BN('9007199254740993'),communityMintMaxVoteWeightSource:{type:0,value:new BN('10000000000')}};
 const tokens = {communityTokenConfig:{tokenType:0,voterWeightAddin:pk('old-addin')},councilTokenConfig:{tokenType:1}};
 const proposed = {...current,useCouncilMint:false,communityTokenConfigArgs:{tokenType:0,useVoterWeightAddin:true,useMaxVoterWeightAddin:false},councilTokenConfigArgs:{tokenType:1,useVoterWeightAddin:false,useMaxVoterWeightAddin:false}};
 const comparison=compareConfigRows(realmConfigRows(proposed,{community:6},['realm','authority','system','config','new-addin']),currentRealmConfigRows(current,tokens,{community:6}));
 assert.deepEqual(comparison.filter(r=>r.changed).map(r=>r.label),['Council mint','Community voter weight add-in']);
 assert.equal(comparison[0].previous,'9,007,199,254.740993');
 const partial=compareConfigRows(realmConfigRows(proposed),currentRealmConfigRows(current,undefined));
 assert.equal(partial.find(r=>r.label==='Community token type').changed,null);
});
