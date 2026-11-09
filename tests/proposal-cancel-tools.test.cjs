const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const React=require('react');
const {JSDOM}=require('jsdom');
const {transformSync}=require('@babel/core');
const dom=new JSDOM('<html><body></body></html>',{url:'https://governance.so'});
for(const key of ['window','document','HTMLElement','Node','Event','DocumentFragment'])global[key]=dom.window[key];
const {render,screen,fireEvent,cleanup}=require('@testing-library/react');
function load(file,mocks={}){
 const mod={exports:{}};new Function('module','exports','require',transformSync(fs.readFileSync(file,'utf8'),{
  filename:file,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs'],
 }).code)(mod,mod.exports,id=>id in mocks?mocks[id]:require(id));return mod.exports;
}
const {canCancelProposal}=load('src/Governance/Proposals/proposalAuthority.ts',{'../api/queries':{}});
const record={pubkey:'record',account:{governingTokenOwner:'owner',governanceDelegate:'delegate'}};
const proposal=state=>({account:{state,tokenOwnerRecord:'record',votingAt:100}});
const config={baseVotingTime:50,votingCoolOffTime:10};
test('cancellation requires the exact proposal owner record and its owner or delegate',()=>{
 for(const wallet of ['owner','delegate'])for(const state of [0,1,2])assert.equal(canCancelProposal(proposal(state),record,wallet,config,120),true);
 for(const wallet of [null,'stranger'])assert.equal(canCancelProposal(proposal(0),record,wallet,config,120),false);
 assert.equal(canCancelProposal(proposal(0),{...record,pubkey:'other-record'},'owner',config,120),false);
 assert.equal(canCancelProposal(proposal(0),null,'owner',config,120),false);
 for(const state of [3,4,5,6,7,8,9,null,undefined])assert.equal(canCancelProposal(proposal(state),record,'owner',config,120),false);
});
test('voting cancellation includes cool-off but ends when voting expires',()=>{
 assert.equal(canCancelProposal(proposal(2),record,'owner',config,155),true);
 assert.equal(canCancelProposal(proposal(2),record,'owner',config,160),true);
 assert.equal(canCancelProposal(proposal(2),record,'owner',config,161),false);
 assert.equal(canCancelProposal(proposal(2),record,'owner',undefined,120),false);
 assert.equal(canCancelProposal({account:{...proposal(2).account,votingAt:null}},record,'owner',config,120),false);
});
let cancelProps;
const Actions=load('src/Governance/Demo/ProposalManagementActions.tsx',{
 '../ManageGovernanceProposal':{ManageGovernanceProposal:props=>{
  if(props.mode===3)cancelProps=props;
  return React.createElement('button',null,({1:'Sign off',2:'Add signer',3:'Cancel Proposal',5:'Finalize Proposal'})[props.mode]);
 }},
}).default;
const Settings=load('src/Governance/Demo/ProposalSettings.tsx',{
 './WalletActions':{__esModule:true,default:()=>null},
}).default;
afterEach(()=>{cleanup();cancelProps=undefined;});
function tools(wallet,state){
 const instructions=[{account:{instructions:[{}]}}];
 const management=React.createElement(Actions,{connected:!!wallet,canManageDraft:false,pendingSigner:false,canFinalize:false,
  canCancel:canCancelProposal(proposal(state),record,wallet,config,120),managementProps:{proposal:proposal(state),proposalInstructions:instructions}});
 render(React.createElement(Settings,{settings:{values:[],addresses:[],signers:[]},management}));
 return instructions;
}
test('the settings cog exposes cancellation and forwards instruction rent-warning data',async()=>{
 const instructions=tools('owner',0);
 assert.equal(screen.queryByRole('button',{name:'Cancel Proposal'}),null);
 fireEvent.click(screen.getByRole('button',{name:'Proposal tools'}));
 await screen.findByRole('button',{name:'Cancel Proposal'});
 assert.equal(cancelProps.mode,3);
 assert.equal(cancelProps.proposalInstructions,instructions);
});
test('delegate sees cancellation while other wallets and completed proposals do not',async()=>{
 for(const [wallet,state,visible] of [['delegate',2,true],['stranger',0,false],[null,0,false],['owner',5,false]]){
  tools(wallet,state);fireEvent.click(screen.getByRole('button',{name:'Proposal tools'}));
  await screen.findByRole('dialog');
  assert.equal(!!screen.queryByRole('button',{name:'Cancel Proposal'}),visible);
  cleanup();
 }
});
