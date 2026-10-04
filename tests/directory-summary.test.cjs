const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {transformSync}=require('@babel/core');
const filename=path.resolve('src/Governance/directorySummary.ts');
const loaded=new Module(filename,module);
loaded._compile(transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);
const {buildParticipatingDirectory,directorySummary}=loaded.exports;
const pk=value=>({toBase58:()=>value});
test('zero-deposit plugin records and delegated memberships remain visible, deduplicated by realm',()=>{
 const records=[{account:{realm:pk('realm-a'),governingTokenDepositAmount:0}}, {account:{realm:'realm-a'}}, {account:{realm:'realm-b',governanceDelegate:pk('wallet')}}];
 const result=buildParticipatingDirectory(records,[{realm:'realm-a',governanceAddress:'realm-a',governanceName:'Alpha'}]);
 assert.equal(result.length,2);
 assert.equal(result.find(item=>item.realm==='realm-a').governanceName,'Alpha');
 assert.equal(result.find(item=>item.realm==='realm-b').governanceAddress,'realm-b');
});
test('cleared or disconnected wallet has no participating DAOs',()=>{
 assert.deepEqual(buildParticipatingDirectory([],[{governanceAddress:'realm-a'}]),[]);
});
test('summary counts unique realms, verified entries and councils without using activity snapshots',()=>{
 const item={governanceAddress:'realm-a',gspl:{},councilMint:pk('mint'),totalProposalsVoting:999,totalMembers:999};
 assert.deepEqual(directorySummary([item,item,{governanceAddress:'realm-b'},{}]),{daos:2,verified:1,councils:1});
});

test('cached nested realm accounts retain directory counts and wallet matches',()=>{
 const dao={governanceAddress:'realm-a',realm:{pubkey:'realm-a',account:{config:{councilMint:'mint'}}},governanceName:'Named DAO',gspl:{}};
 assert.deepEqual(directorySummary([dao]),{daos:1,verified:1,councils:1});
 assert.equal(buildParticipatingDirectory([{account:{realm:pk('realm-a')}}],[dao])[0],dao);
});
test('recent proposal window ranks DAOs by newest proposal, deduplicates and stops at 100',()=>{
 const {rankDirectoryByProposals}=loaded.exports;
 const directory=[{governanceAddress:'a',governanceName:'Alpha',governances:[{pubkey:'ga'}]}, {governanceAddress:'b',governanceName:'Beta',governances:[{pubkey:'gb'}]}];
 const proposals=Array.from({length:101},(_,i)=>({pubkey:`p${i}`,governance:i===0?'ga':'gb',draftAt:i+1,name:`Proposal ${i}`}));
 const ranked=rankDirectoryByProposals(directory,[...proposals,proposals[100]]);
 assert.equal(ranked[0].governanceAddress,'b');
 assert.equal(ranked[0].recentActivity.count,100);
 assert.equal(ranked[0].recentActivity.latestName,'Proposal 100');
 assert.equal(ranked[1].recentActivity,undefined);
});
