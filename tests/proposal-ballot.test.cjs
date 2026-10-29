const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'https://governance.so'});
for(const k of ['window','document','HTMLElement','Node','Event','MouseEvent'])global[k]=dom.window[k];
global.navigator=dom.window.navigator;
const React=require('react');
const {render,screen,fireEvent,cleanup}=require('@testing-library/react');
const {transformSync}=require('@babel/core');
let submitted;
function load(file){
 const mod={exports:{}};
 const code=transformSync(fs.readFileSync(file,'utf8'),{filename:file,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 new Function('module','exports','require',code)(mod,mod.exports,id=>{
  if(id.endsWith('ballotRules'))return load('src/utils/governanceTools/ballotRules.ts');
  if(id==='./VoterBreakdown')return {formatVoterPower:x=>x};
  if(id==='../GovernanceVote')return {VoteForProposal:props=>React.createElement('button',{disabled:!!props.castDisabledReason,onClick:()=>submitted=props.multiChoice?.weights},props.ballotLabel||'Against')};
  return require(id);
 });return mod.exports;
}
const Ballot=load('src/Governance/Demo/ProposalBallot.tsx').default;
const options=[{label:'Research',voteWeight:'10'},{label:'Development',voteWeight:'20'},{label:'Operations',voteWeight:'30'}];
const mount=(voteType,extra={})=>render(React.createElement(Ballot,{thisitem:{account:{state:2,options,voteType,denyVoteWeight:null,...extra}},decimals:0}));
test('single-choice poll shows option results and no Against button',()=>{
 try{mount({type:0});assert.equal(screen.queryByRole('button',{name:'Against'}),null);
 assert.ok(screen.getByRole('button',{name:'Submit choices'}).disabled);
 fireEvent.click(screen.getByRole('radio',{name:/Development/}));
 fireEvent.click(screen.getByRole('button',{name:'Submit choices'}));assert.deepEqual(submitted,[0,100,0]);
 }finally{cleanup();}
});
test('multiple selection and weighted inputs enforce configured limits',()=>{
 try{mount({type:1,choiceType:0,minVoterOptions:2,maxVoterOptions:2});
 fireEvent.click(screen.getByRole('checkbox',{name:/Research/}));assert.ok(screen.getByRole('button',{name:'Submit choices'}).disabled);
 fireEvent.click(screen.getByRole('checkbox',{name:/Operations/}));assert.equal(screen.getByRole('button',{name:'Submit choices'}).disabled,false);
 fireEvent.click(screen.getByRole('button',{name:'Submit choices'}));assert.deepEqual(submitted,[100,0,100]);
 }finally{cleanup();}
 try{mount({type:1,choiceType:1,minVoterOptions:1,maxVoterOptions:3},{denyVoteWeight:'0'});
 fireEvent.change(screen.getByRole('spinbutton',{name:'Research allocation percent'}),{target:{value:'40'}});
 assert.ok(screen.getByRole('button',{name:'Submit choices'}).disabled);
 fireEvent.change(screen.getByRole('spinbutton',{name:'Development allocation percent'}),{target:{value:'60'}});
 fireEvent.click(screen.getByRole('button',{name:'Submit choices'}));assert.deepEqual(submitted,[40,60,0]);
 assert.ok(screen.getByRole('button',{name:'Against'}));
 }finally{cleanup();}
});
test('closed polls retain results and do not offer a new ballot',()=>{
 try{mount({type:0},{state:5});assert.equal(screen.queryByRole('button',{name:'Submit choices'}),null);assert.match(screen.getByRole('status').textContent,/Voting is closed/);}finally{cleanup();}
});

test('closed weighted poll shows result shares instead of allocation inputs',()=>{
 try{mount({type:1,choiceType:1,minVoterOptions:1,maxVoterOptions:3},{state:5});
 assert.equal(screen.queryByRole('spinbutton'),null);
 assert.equal(screen.queryByRole('radio'),null);
 assert.ok(screen.getByText('50.0%'));
 assert.ok(screen.getByText('Poll results'));
 }finally{cleanup();}
});
test('draft poll is pending rather than closed',()=>{
 try{mount({type:0},{state:0});assert.match(screen.getByRole('status').textContent,/not started/);}finally{cleanup();}
});
