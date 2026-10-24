const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('@babel/core');
const mod = { exports: {} };
new Function('module', 'exports', transformSync(fs.readFileSync('src/utils/governanceTools/ballotRules.ts','utf8'), {
 filename:'ballotRules.ts', configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs'],
}).code)(mod,mod.exports);
const { ballotRules, ballotChoices, validateBallot, voteAvailability } = mod.exports;
const options = [{label:'A'},{label:'B'},{label:'C'}];
const single = {options, voteType:{type:0},denyVoteWeight:'0'};
const full = {...single,voteType:{type:1,choiceType:0,minVoterOptions:1,maxVoterOptions:2}};
const weighted = {...full,voteType:{...full.voteType,choiceType:1}};
test('single-choice supports named options; polls never gain an Against action',()=>{
 assert.equal(ballotRules(single).binary,false);
 assert.equal(ballotRules({...single,denyVoteWeight:null}).poll,true);
 assert.equal(ballotRules({...single,denyVoteWeight:null}).canDeny,false);
 assert.equal(ballotRules({}).binary,true);
 assert.deepEqual(ballotChoices(single,{index:1}),[{rank:0,weightPercentage:0},{rank:0,weightPercentage:100},{rank:0,weightPercentage:0}]);
 assert.throws(()=>ballotChoices(single,{weights:[100,100,0]}),/Select 1 option/);
});
test('full-weight ballots enforce selection bounds and preserve option ordering',()=>{
 assert.deepEqual(ballotChoices(full,{weights:[100,0,100]}).map(x=>x.weightPercentage),[100,0,100]);
 assert.match(validateBallot(full,[0,0,0]),/between 1 and 2/);
 assert.match(validateBallot(full,[100,100,100]),/between 1 and 2/);
 assert.match(validateBallot(full,[50,50,0]),/full voting power/);
});
test('weighted ballots enforce exactly 100 percent and reject malformed inputs',()=>{
 assert.equal(validateBallot(weighted,[40,0,60]),null);
 for (const weights of [[40,0,59],[80,0,30],[1.5,0,98.5],[-1,0,101],[NaN,0,100],[100]]) assert.ok(validateBallot(weighted,weights));
 assert.match(validateBallot({...weighted,voteType:{...weighted.voteType,minVoterOptions:2}},[100,0,0]),/Select 2/);
 assert.match(validateBallot({...single,voteType:{type:9}},[100,0,0]),/not supported/);
});
test('base period, cool-off, finalization and closed states gate electorate votes',()=>{
 const account={state:2,votingAt:100,signingOffAt:50};
 const config={baseVotingTime:60,votingCoolOffTime:20};
 assert.equal(voteAvailability(account,config,0,150),null);
 assert.match(voteAvailability(account,config,0,165),/cool-off/);
 assert.equal(voteAvailability(account,config,1,165),null);
 assert.match(voteAvailability(account,config,1,181),/finalized/);
 assert.match(voteAvailability({...account,state:5},config,0,150),/closed/);
 assert.equal(voteAvailability({...account,maxVotingTime:120},config,0,170),null);
});
