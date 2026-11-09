const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {transformSync} = require('@babel/core');
const mod={exports:{}};
new Function('module','exports',transformSync(fs.readFileSync('src/Governance/Treasury/tokenPrices.ts','utf8'),{
 filename:'tokenPrices.ts',configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs'],
}).code)(mod,mod.exports);
const {sortTreasuryTokens}=mod.exports;
const usdc='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const tokens=[{address:usdc,balance:360},{address:'unpriced',balance:500}];
test('balances arriving before prices or after a failed lookup still render in balance order',()=>{
 for(const prices of [null,undefined,{}]){
  assert.deepEqual(sortTreasuryTokens(tokens,prices).map(token=>token.address),['unpriced',usdc]);
 }
 assert.deepEqual(sortTreasuryTokens(null,null),[]);
 assert.deepEqual(tokens.map(token=>token.address),[usdc,'unpriced'],'sorting does not mutate React state');
});
test('partial prices put priced tokens first and full prices sort by dollar value',()=>{
 assert.equal(sortTreasuryTokens(tokens,{[usdc]:{usdPrice:1}})[0].address,usdc);
 assert.equal(sortTreasuryTokens(tokens,{[usdc]:{usdPrice:'1'},unpriced:{usdPrice:2}})[0].address,'unpriced');
 assert.equal(sortTreasuryTokens(tokens,{[usdc]:{usdPrice:0}})[0].address,usdc,'a recorded zero price remains valid');
});
test('invalid quote values are treated as unavailable',()=>{
 for(const price of [null,'',NaN,Infinity,-1,'not-a-price']){
  assert.equal(sortTreasuryTokens(tokens,{[usdc]:{usdPrice:price}})[0].address,'unpriced');
 }
});
