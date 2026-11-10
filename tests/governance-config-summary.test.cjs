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
