const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),Module=require('module'),path=require('path');
const {transformSync}=require('@babel/core');
const filename=path.resolve('src/Governance/api/grapeProposalEligibility.ts');
const realm={toBase58:()=> 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip'};
function setup({verified=true,points=1n,rpcError=false,currentPoints=true}={}){
 const loaded=new Module(filename,module);loaded.paths=Module._nodeModulePaths(path.dirname(filename));const base=loaded.require.bind(loaded);
 let checkedSeason;
 loaded.require=id=>id==='./grapeVerification'?{
 GRAPE_VERIFICATION_PROGRAM_ID:{},deriveVerificationSpacePda:()=>[{}],parseVerificationSpace:()=>({daoId:{equals:()=>true},salt:[],isFrozen:false}),hashVerificationWallet:async()=>Buffer.from([1]),parseVerificationLink:()=>({walletHash:Buffer.from([1]),identity:{}}),parseVerificationIdentity:()=>({space:{equals:()=>true},verified,expiresAt:0}),
 }:id==='@grapenpm/vine-reputation-client'?{
 fetchConfig:async()=>({daoId:{equals:()=>true},currentSeason:3}),fetchReputationsForDaoSeason:async()=>[{points:currentPoints?1n:0n}],fetchReputation:async(c,r,w,season)=>{checkedSeason=season;return {points}},
 }:base(id);
 loaded._compile(transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);
 const account={owner:{equals:()=>true},data:[]};
 const connection={getAccountInfo:async()=>{if(rpcError)throw Error('offline');return account},getProgramAccounts:async()=>[{account}],getMultipleAccountsInfo:async()=>[account]};
 return {status:()=>loaded.exports.getGrapeProposalEligibility(connection,realm,{}),check:(r=realm)=>loaded.exports.assertGrapeProposalEligibility(connection,r,{}),season:()=>checkedSeason};
}
test('requires both reputation and verification',async()=>{await setup().check();await assert.rejects(setup({verified:false}).check(),/verification is required/);await assert.rejects(setup({points:0n}).check(),/reputation in season 3/)});
test('fails closed on RPC errors',async()=>{await assert.rejects(setup({rpcError:true}).check(),/creation blocked/)});
test('uses previous season only when current baseline has no points',async()=>{const a=setup({currentPoints:false});await a.check();assert.equal(a.season(),2);const b=setup();await b.check();assert.equal(b.season(),3)});
test('does not restrict other DAOs',async()=>{await setup({rpcError:true}).check({toBase58:()=> 'other'})});

test('reports reputation independently when verification fails',async()=>{
 const status=await setup({verified:false}).status();
 assert.equal(status.verification.passed,false);
 assert.equal(status.reputation.passed,true);
 assert.match(status.reputation.message,/1 points/);
});
