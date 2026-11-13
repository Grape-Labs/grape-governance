const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {transformSync} = require('@babel/core');
const source = fs.readFileSync('src/Governance/ManageGovernanceProposal.tsx', 'utf8');
const body = source.slice(source.indexOf('    const handleSignOffIx = async() => {'), source.indexOf('    const handleSignOff ='));
const code = transformSync(body + '\nreturn handleSignOffIx;', {filename:'signoff.ts', configFile:false, babelrc:false, presets:['@babel/preset-typescript'], parserOpts:{allowReturnOutsideFunction:true}}).code;
for (const count of [0, 2]) test(`sign-off selects correct authority accounts with ${count} required signers`, async () => {
 let args;
 const factory = new Function('PublicKey','realm','editProposalAddress','governanceAddress','RPC_CONNECTION','getGrapeGovernanceProgramVersion','resolveProposalAuthorityRecordPk','publicKey','getProposal','getSignatoryRecordAddress','withSignOffProposal','governanceRulesWallet', code);
 const run = factory(class {constructor(value){this.value=value;}}, {owner:'program'}, 'proposal', 'realm', {}, async()=>3, ()=> 'owner-record', 'wallet', async()=>({account:{signatoriesCount:count}}), async()=> 'signer-record', (...value)=>{args=value;}, 'governance');
 await run();
 assert.equal(args[7], count ? 'signer-record' : undefined);
 assert.equal(args[8], count ? undefined : 'owner-record');
});
