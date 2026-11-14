const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {transformSync} = require('@babel/core');
function load(path, overrides={}) {
 const mod={exports:{}};
 const code=transformSync(fs.readFileSync(path,'utf8'),{filename:path,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 new Function('require','module','exports',code)(name=>overrides[name] || require(name),mod,mod.exports);
 return mod.exports;
}
const helpers=load('src/Governance/Treasury/stakeAccountSummary.ts');
const {summarizeStakeAccounts,upsertWalletValue}=helpers;
test('includes active, inactive and rent balances once per stake address',()=>{
 const active={pubkey:'active',total_amount:10,rent:0.002,state:'active',delegated_amount:9};
 const inactive={stake_account_address:'inactive',total_amount:20,rent:0.002,state:'initialized'};
 const summary=summarizeStakeAccounts([active,inactive],[{...active}]);
 assert.equal(summary.total,30);assert.equal(summary.active,9);assert.ok(Math.abs(summary.inactive-20.996)<1e-9);
 assert.equal(summary.accounts.length,2);assert.equal(summary.accounts[0].address,'inactive');
 assert.equal(summary.accounts[0].status,'Inactive');
 assert.equal(summary.accounts[1].source,'Treasury');
});
test('handles unloaded and malformed data without poisoning wallet totals',()=>{
 assert.equal(summarizeStakeAccounts(null,null).total,0);
 assert.equal(summarizeStakeAccounts([{pubkey:'bad',total_amount:'bad'},{pubkey:'negative',total_amount:-1}]).total,0);
 assert.equal(summarizeStakeAccounts([{pubkey:'raw',lamports:2e9}]).total,2);
});
test('updates treasury totals after loading stake instead of keeping the initial value',()=>{
 const initial=[{address:'wallet',totalVal:100,solAccountVal:50},{address:'other',totalVal:25}];
 const updated=upsertWalletValue(initial,{address:'wallet',totalVal:2100,solAccountVal:2050});
 assert.equal(updated.length,2);assert.equal(updated.reduce((sum,w)=>sum+w.totalVal,0),2125);
 assert.equal(upsertWalletValue(updated,{address:'wallet',totalVal:2100,solAccountVal:2050}),updated);
});
test('stake panel renders compact copyable addresses, totals, loading and retry states',()=>{
 const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server');
 const Panel=load('src/Governance/Treasury/StakeAccountsPanel.tsx',{'./stakeAccountSummary':helpers}).default;
 const address='ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789abcdefghijk';
 const render=props=>renderToStaticMarkup(React.createElement(Panel,props));
 const html=render({native:[{pubkey:address,total_amount:10,state:'initialized',rent:0.002}],solPrice:70});
 assert.ok(html.includes('ABCDEF…fghijk'));assert.ok(html.includes(`Copy stake account ${address}`));
 assert.ok(html.includes('$700.00'));assert.ok(html.includes('included in wallet value'));assert.ok(html.includes('Rent reserve'));
 assert.ok(render({loading:true}).includes('Loading stake accounts'));
 assert.ok(render({failed:true}).includes('Try again'));
});
