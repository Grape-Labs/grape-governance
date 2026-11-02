const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {transformSync}=require('@babel/core');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<html><body></body></html>',{url:'https://governance.so/council/realm'});
for(const key of ['window','document','HTMLElement','Node','Event','MouseEvent'])global[key]=dom.window[key];
global.navigator=dom.window.navigator;
const React=require('react');
const {render,screen,fireEvent,waitFor,cleanup,act}=require('@testing-library/react');
let wallet='owner',state,checkPassed=true,prepared=[],sent=[],confirmed=[],prepareGate=null;
const realm={pubkey:'realm',account:{communityMint:'community',config:{councilMint:'council'}}};
const record=(owner,mint='council',delegate=null)=>({pubkey:owner+'Record',account:{realm:'realm',governingTokenMint:mint,governingTokenOwner:owner,governingTokenDepositAmount:'1',governanceDelegate:delegate}});
function load(filename,mocks){const m={exports:{}};new Function('module','exports','require',transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code)(m,m.exports,id=>id in mocks?mocks[id]:require(id));return m.exports;}
const policy=load('src/Governance/Demo/councilDelegationPolicy.ts',{});
const Page=load('src/Governance/Demo/CouncilDelegationPage.tsx',{
 'react-router-dom':{useParams:()=>({handlekey:'realm'})},
 '@solana/wallet-adapter-react':{useWallet:()=>({publicKey:wallet?{toBase58:()=>wallet}:null,sendTransaction:async tx=>{sent.push(tx);return 'signature';}})},
 '../../utils/grapeTools/constants':{RPC_CONNECTION:{}},
 './DaoPageLayout':{__esModule:true,default:({children})=>React.createElement('div',null,children)},
 './WalletActions':{__esModule:true,default:({address})=>React.createElement('span',null,address)},
 './useCouncilDelegation':{useCouncilDelegation:()=>({...state,wallet,refresh:()=>{}})},
 './councilDelegationPolicy':policy,
 './councilDelegation':{
  checkCouncilRecipient:async()=>({verification:{passed:checkPassed,message:'Active verification'},reputation:{passed:checkPassed,message:'85 points'}}),
  prepareCouncilDelegation:async(...args)=>{prepared.push(args);if(prepareGate) await prepareGate;return {transaction:'transaction',blockhash:{blockhash:'block',lastValidBlockHeight:1}};},
  confirmCouncilDelegation:async(...args)=>{confirmed.push(args);},
 },
}).default;
function reset(){prepareGate=null;wallet='owner';checkPassed=true;prepared=[];sent=[];confirmed=[];state={realm,records:[record('owner'),record('member','community')],owned:[record('owner')],incoming:[],allowed:true};}
afterEach(cleanup);
test('direct page access hides controls from disconnected, unauthorized and unresolved wallets',()=>{
 for(const mode of ['disconnected','unauthorized','loading','error']){
  reset();if(mode==='disconnected')wallet='';if(mode==='unauthorized')state.allowed=false;if(mode==='loading')state.loading=true;if(mode==='error')state.error='Access unavailable';
  render(React.createElement(Page));assert.equal(screen.queryByLabelText('Find an existing DAO member'),null);cleanup();
 }
});
test('delegate-only visitor sees incoming owners without delegation controls',()=>{
 reset();wallet='delegate';state.owned=[];state.incoming=[record('owner','council','delegate')];
 render(React.createElement(Page));assert.ok(screen.getByText('Council delegate'));assert.equal(screen.queryByLabelText('Find an existing DAO member'),null);assert.ok(screen.getByText('owner'));
});
test('qualified member can be selected and confirmed using the prepared transaction blockhash',async()=>{
 reset();render(React.createElement(Page));fireEvent.click(screen.getByRole('button',{name:'Select member'}));
 await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Delegate council voting authority'}).disabled,false));
 fireEvent.click(screen.getByRole('button',{name:'Delegate council voting authority'}));
 await screen.findByText('Council delegation confirmed.');
 assert.deepEqual(prepared,[['realm','owner','member']]);assert.deepEqual(sent,['transaction']);
 assert.deepEqual(confirmed,[['signature',{blockhash:'block',lastValidBlockHeight:1}]]);
});
test('failed recipient checks keep delegation disabled',async()=>{
 reset();checkPassed=false;render(React.createElement(Page));fireEvent.click(screen.getByRole('button',{name:'Select member'}));
 await screen.findByText('× Verification: Active verification');assert.equal(screen.getByRole('button',{name:'Delegate council voting authority'}).disabled,true);assert.equal(prepared.length,0);
});
test('owner can revoke an existing delegate without selecting a recipient',async()=>{
 reset();state.owned=[record('owner','council','oldDelegate')];render(React.createElement(Page));fireEvent.click(screen.getByRole('button',{name:'Revoke delegation'}));
 await screen.findByText('Council delegation revoked.');assert.deepEqual(prepared,[['realm','owner',null]]);
});

test('switching wallets during preparation prevents sending from the previous account',async()=>{
 reset();let release;prepareGate=new Promise(resolve=>{release=resolve;});
 state.owned=[record('owner','council','oldDelegate')];
 const view=render(React.createElement(Page));fireEvent.click(screen.getByRole('button',{name:'Revoke delegation'}));
 await waitFor(()=>assert.equal(prepared.length,1));
 wallet='other';state.owned=[];state.allowed=false;
 view.rerender(React.createElement(Page));
 await act(async()=>{release();await prepareGate;});
 assert.equal(sent.length,0);
});
