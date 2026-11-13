const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {transformSync} = require('@babel/core');
const {PublicKey, Keypair} = require('@solana/web3.js');
const {getAssociatedTokenAddress} = require('@solana/spl-token-v2');
const registry = new Map();
const mod = {exports:{}};
new Function('require','module','exports',transformSync(fs.readFileSync('src/Governance/Treasury/plugins/batchTransferTokens.ts','utf8'),{filename:'batchTransferTokens.ts',configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code)(name => name === './swapTokenOptions' ? {getTokenMap: async()=> registry, shortMintLabel: mint=>mint.slice(0,4)} : require(name),mod,mod.exports);
const {fetchBatchTransferTokens} = mod.exports;
test('detects only spendable treasury ATA balances, including wrapped SOL', async()=>{
 const owner=Keypair.generate().publicKey;
 const mint=new PublicKey('So11111111111111111111111111111111111111112');
 const ata=await getAssociatedTokenAddress(mint,owner,true);
 const row=(pubkey,amount,state='initialized')=>({pubkey,account:{data:{parsed:{info:{mint:mint.toBase58(),state,tokenAmount:{amount,decimals:9,uiAmountString:'1.23456789'}}}}}});
 const conn={getParsedTokenAccountsByOwner:async wallet=>{assert.ok(wallet.equals(owner));return {value:[row(ata,'1234567890'),row(Keypair.generate().publicKey,'9999999999'),row(ata,'0'),row(ata,'500','frozen')]};}};
 const tokens=await fetchBatchTransferTokens(conn,owner.toBase58());
 assert.equal(tokens.length,1); assert.equal(tokens[0].balanceRaw,'1234567890');assert.equal(tokens[0].mint,mint.toBase58());assert.equal(tokens[0].name,'Unlisted token');
});
test('handles empty treasury and reports RPC failures',async()=>{
 const owner=Keypair.generate().publicKey.toBase58();
 assert.deepEqual(await fetchBatchTransferTokens({getParsedTokenAccountsByOwner:async()=>({value:[]})},owner),[]);
 await assert.rejects(fetchBatchTransferTokens({getParsedTokenAccountsByOwner:async()=>{throw new Error('offline');}},owner),/offline/);
});

test('named tokens rank first, balances rank within groups, and singleton NFTs are excluded', async()=>{
 const {TOKEN_PROGRAM_ID}=require('@solana/spl-token-v2');
 const owner=Keypair.generate().publicKey;
 const mints=Array.from({length:5},()=>Keypair.generate().publicKey);
 registry.set(mints[0].toBase58(),{name:'Named low',symbol:'LOW'});
 registry.set(mints[1].toBase58(),{name:'Named high',symbol:'HIGH'});
 const amounts=['1','20','100000','1','1'];
 const rows=await Promise.all(mints.map(async(mint,index)=>({pubkey:await getAssociatedTokenAddress(mint,owner,true),account:{data:{parsed:{info:{mint:mint.toBase58(),state:'initialized',tokenAmount:{amount:amounts[index],decimals:0}}}}}})));
 const conn={getParsedTokenAccountsByOwner:async()=>({value:rows}),getMultipleAccountsInfo:async(keys)=>keys.map(key=>{
  const data=Buffer.alloc(82);data.writeBigUInt64LE(key.equals(mints[3]) ? 1n : 1000000n,36);
  return {owner:TOKEN_PROGRAM_ID,data};
 })};
 const result=await fetchBatchTransferTokens(conn,owner.toBase58());
 assert.deepEqual(result.map(token=>token.mint),[mints[1],mints[0],mints[2],mints[4]].map(mint=>mint.toBase58()));
 assert.ok(result.some(token=>token.mint===mints[4].toBase58()),'one held token from a fungible supply remains selectable');
 registry.clear();
});
