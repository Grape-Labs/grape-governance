const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const React=require('react');
const {JSDOM}=require('jsdom');
const {transformSync}=require('@babel/core');
const dom=new JSDOM('<html><body></body></html>',{url:'https://governance.so'});
for(const name of ['window','document','HTMLElement','Node','Event'])global[name]=dom.window[name];
const {render,screen,fireEvent,waitFor,cleanup}=require('@testing-library/react');
const {PublicKey}=require('@solana/web3.js');
const realm='By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip';
let calls=0,fail=true,failGovernances=false;
const mocks={
 'react-router-dom':{useParams:()=>({})},
 '@solana/wallet-adapter-react':{useWallet:()=>({publicKey:null})},
 '@solana/spl-token-registry':{ENV:{MainnetBeta:101},TokenListProvider:class {async resolve(){return {filterByChainId:()=>({getList:()=>[]})};}}},
 '@solana/spl-token-v2':{getMint:async()=>({decimals:6})},
 '@solana/spl-governance':{getNativeTreasuryAddress:async()=>new PublicKey(realm)},
 './Treasury/WalletCardView':{__esModule:true,default:()=>null},
 './GovernanceHeaderView':{GovernanceHeaderView:()=>null},
 './GovernanceNavigation':{__esModule:true,default:()=>null},
 '../Governance/api/queries':{
  getRealmIndexed:async()=>{calls++;if(fail)throw Error('HTTP 429');return {pubkey:new PublicKey(realm),owner:new PublicKey(realm),account:{name:'Grape',communityMint:new PublicKey(realm)}};},
  getAllGovernancesIndexed:async()=>{if(failGovernances)throw Error('HTTP 429');return [];},getRealmConfigIndexed:async()=>({}),
 },
 './api/gspl_queries':{initGrapeGovernanceDirectory:async()=>[]},
 './api/realmMetadata':{resolveRealmMetadata:async()=>({})},
 '../utils/grapeTools/constants':{RPC_CONNECTION:{},GGAPI_STORAGE_POOL:'test'},
 '../utils/governanceTools/vsrPlugin':{isVsrPluginForRealm:async()=>false},
};
const mod={exports:{}};
new Function('module','exports','require',transformSync(fs.readFileSync('src/Governance/GovernanceTreasury.tsx','utf8'),{
 filename:'GovernanceTreasury.tsx',configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs'],
}).code)(mod,mod.exports,id=>id in mocks?mocks[id]:require(id));
afterEach(cleanup);
test('a failed realm request stays in the treasury page and can be retried',async()=>{
 render(React.createElement(mod.exports.GovernanceTreasuryView,{governanceAddress:realm,compactLayout:true,showGovernanceNavigation:false}));
 await screen.findByText('Treasury data is temporarily unavailable. Please try again.');
 assert.equal(calls,1);
 fail=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>assert.equal(calls,2));
 await waitFor(()=>assert.equal(screen.queryByRole('alert'),null));
 await screen.findByText('Treasury Value');
});

test('failed treasury account requests also show a recoverable error',async()=>{
 calls=0;fail=false;failGovernances=true;
 render(React.createElement(mod.exports.GovernanceTreasuryView,{governanceAddress:realm,compactLayout:true,showGovernanceNavigation:false}));
 await screen.findByText('Treasury data is temporarily unavailable. Please try again.');
 failGovernances=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>assert.equal(calls,2));
 await waitFor(()=>assert.equal(screen.queryByRole('alert'),null));
});
