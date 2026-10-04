const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const bs58=require('bs58');
const {transformSync}=require('@babel/core');
const filename=path.resolve('src/Governance/api/recentDirectoryActivity.ts');
const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));
loaded._compile(transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);
const {proposalsFromTransaction,fetchRecentDirectoryActivity}=loaded.exports;
const program='GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
function tx(id=0){
 const name=Buffer.from('A new proposal');const data=Buffer.alloc(5+name.length);data[0]=6;data.writeUInt32LE(name.length,1);name.copy(data,5);
 return {blockTime:id+1,meta:{err:null},transaction:{message:{instructions:[{programId:program,accounts:['realm',`p${id}`,'governance'],data:bs58.encode(data)}]}}};
}
test('creation decoder supports direct and inner instructions and rejects failed transactions',()=>{
 const transaction=tx();assert.equal(proposalsFromTransaction(transaction,new Set([program]))[0].name,'A new proposal');
 transaction.meta.innerInstructions=[{instructions:transaction.transaction.message.instructions}];transaction.transaction.message.instructions=[];
 assert.equal(proposalsFromTransaction(transaction,new Set([program])).length,1);
 transaction.meta.err={failed:true};assert.deepEqual(proposalsFromTransaction(transaction,new Set([program])),[]);
});
test('activity caps transaction reads at 100 globally and reuses its result',async()=>{
 let calls=0,active=0,max=0;
 const rpc={getSignaturesForAddress:async(_,options)=>{assert.equal(options.limit,100);return Array.from({length:100},(_,i)=>({signature:String(i),slot:i,err:null}));},getParsedTransaction:async id=>{calls++;active++;max=Math.max(max,active);await Promise.resolve();active--;return tx(Number(id));}};
 const [result,duplicate]=await Promise.all([fetchRecentDirectoryActivity(rpc,[program,program]),fetchRecentDirectoryActivity(rpc,[program])]);
 assert.equal(calls,100);assert.ok(max<=4);assert.equal(result.proposals.length,100);assert.equal(result.proposals[0].pubkey,'p99');assert.equal(result,duplicate);
 assert.equal(await fetchRecentDirectoryActivity(rpc,[program]),result);assert.equal(calls,100);
});
test('RPC errors produce incomplete coverage, not a claim of no proposals',async()=>{
 const result=await fetchRecentDirectoryActivity({getSignaturesForAddress:async()=>{throw Error('offline');}},[program]);
 assert.equal(result.partial,true);assert.equal(result.scanned,0);
});
