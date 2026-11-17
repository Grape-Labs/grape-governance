const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {transformSync}=require('@babel/core');
function load(path){const mod={exports:{}};new Function('require','module','exports',transformSync(fs.readFileSync(path,'utf8'),{filename:path,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code)(require,mod,mod.exports);return mod.exports;}
const {compactGovernancePower}=load('src/Governance/Demo/votingPowerIndicatorModel.ts');
test('shows separate community/council power, includes incoming delegation and retains owner authority',()=>{
 const power=compactGovernancePower({communityPower:1500000,decimals:6,councilPower:1,incomingCouncil:2});
 assert.equal(power.label,'Community 1.5 · Council 3');assert.equal(power.deposit,false);
 assert.equal(compactGovernancePower({communityPower:500,communityDelegate:'other',incomingCommunity:20}).label,'Community 520');
});
test('eligible undeposited governing tokens produce a deposit hint without inflating voting power',()=>{
 const power=compactGovernancePower({availableCommunity:100,availableCouncil:1});
 assert.equal(power.label,'0 voting power');assert.equal(power.deposit,true);assert.match(power.detail,/community and council tokens available to deposit/);
 assert.equal(compactGovernancePower({availableCommunity:0}).deposit,false);
});
test('unknown plugin weight is not presented as ordinary deposited-token voting power',()=>{
 const power=compactGovernancePower({plugin:true,pluginUnknown:true,communityPower:100,incomingCommunity:50});
 assert.equal(power.label,'Community: plugin');assert.match(power.detail,/plugin-managed/);
});
const {JSDOM}=require('jsdom');const dom=new JSDOM('<html><body></body></html>',{url:'https://governance.so/dao/realm'});
for(const key of ['window','document','HTMLElement','Node','Event','MouseEvent','DocumentFragment'])global[key]=dom.window[key];
global.navigator=dom.window.navigator;
const React=require('react');const {render,screen,fireEvent,cleanup}=require('@testing-library/react');
afterEach(cleanup);
const Compact=load('src/Governance/Demo/CompactGovernancePower.tsx').default;
test('one inline trigger opens existing management controls and closes without a permanent panel',()=>{
 render(React.createElement(Compact,{label:'Council 1',detail:'Manage council power',deposit:true},React.createElement('button',null,'Manage council power')));
 assert.equal(screen.queryByRole('dialog'),null);
 assert.ok(screen.getByText('Deposit tokens ↗'));
 fireEvent.click(screen.getByRole('button',{name:'Manage council power'}));
 assert.ok(screen.getByRole('dialog'));assert.ok(screen.getByRole('button',{name:'Manage council power'}));
 fireEvent.click(screen.getByRole('button',{name:'Close voting power'}));
});
test('failed reads say unavailable and offer retry rather than a false zero balance',()=>{
 let retries=0;
 render(React.createElement(Compact,{label:'0 voting power',error:'Voting power could not be loaded',onRetry:()=>retries++}));
 assert.ok(screen.getByText('Power unavailable'));assert.equal(screen.queryByText('Deposit tokens ↗'),null);
 fireEvent.click(screen.getByRole('button',{name:'Voting power could not be loaded'}));assert.equal(retries,1);
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));assert.equal(retries,2);
});
test('popup details present distinct electorate cards with concise balances and direct actions',()=>{
 const {VotingPowerDetails}=load('src/Governance/Demo/CompactGovernancePower.tsx');
 const cards=[{title:'Community',total:'25,945,840.68',own:'25,746,595.88',incoming:'199,244.79',available:'100',canDeposit:true,delegate:'AZpn123456789qgvz',action:React.createElement('button',null,'Manage community')},{title:'Council',total:'1',own:'1',incoming:'0',available:'0',canDeposit:false,action:React.createElement('button',null,'Manage council')}];
 render(React.createElement(VotingPowerDetails,{cards}));
 assert.ok(screen.getByRole('region',{name:'Community voting power'}));assert.ok(screen.getByRole('region',{name:'Council voting power'}));
 assert.ok(screen.getByText('25,945,840.68'));assert.ok(screen.getByText('199,244.79'));assert.ok(screen.getByText('100 tokens available to deposit'));
 assert.ok(screen.getByRole('button',{name:'Manage community'}));assert.ok(screen.getByRole('button',{name:'Manage council'}));
 assert.equal(document.querySelector('details'),null);
});
