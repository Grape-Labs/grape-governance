const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {transformSync}=require('@babel/core');
const sdk=require('@solana/spl-governance');
const {serialize}=Module.createRequire(require.resolve('@solana/spl-governance'))('borsh');
const {PublicKey}=require('@solana/web3.js');
const bs58=require('bs58');
const BN=require('bn.js');
const wallet=new PublicKey('11111111111111111111111111111111');
const program=new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');
function load(connection){
 const filename=path.resolve('src/Governance/api/queries.tsx');
 const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));
 const base=loaded.require.bind(loaded);
 loaded.require=id=>({
  '@apollo/client':{ApolloClient:class {query(){throw Error('GraphQL must not be used');}},InMemoryCache:class{},gql:()=>null},
  '../../utils/grapeTools/constants':{RPC_CONNECTION:connection},
  '../api/gspl_queries':{},
  '../../utils/governanceTools/getVoteRecords':{},
 }[id]||base(id));
 loaded._compile(transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);
 return loaded.exports;
}
function rawRecord(type, owner, delegate){
 const record=new sdk.TokenOwnerRecord({accountType:type,realm:program,governingTokenMint:wallet,governingTokenOwner:owner,
 governingTokenDepositAmount:new BN('9007199254740993'),unrelinquishedVotesCount:0,totalVotesCount:0,outstandingProposalCount:0,
 version:0,reserved:Array(6).fill(0),governanceDelegate:delegate || null});
 return Buffer.from(serialize(sdk.getGovernanceSchemaForAccount(type),record));
}
test('RPC discovery decodes V1/V2 direct and delegate-only memberships without GraphQL',async()=>{
 const calls=[];
 const rows=[
  {pubkey:wallet,account:{owner:program,data:rawRecord(sdk.GovernanceAccountType.TokenOwnerRecordV1,wallet,undefined)}},
  {pubkey:program,account:{owner:program,data:rawRecord(sdk.GovernanceAccountType.TokenOwnerRecordV2,program,wallet)}},
 ];
 const api=load({getProgramAccounts:async(owner,{filters})=>{
  calls.push({owner:owner.toBase58(),filters});
  if(!owner.equals(program))return [];
  return rows.filter(row=>filters.every(({memcmp:{offset,bytes}})=>row.account.data.subarray(offset,offset+bs58.decode(bytes).length).equals(Buffer.from(bs58.decode(bytes)))));
 }});
 const records=await api.getTokenOwnerRecordsByOwnerAcrossProgramsIndexed(wallet.toBase58());
 assert.equal(records.length,2);
 assert.equal(records[1].account.governingTokenDepositAmount.toString(),'9007199254740993');
 assert.ok(calls.some(call=>call.filters.some(f=>f.memcmp.offset===122)));
 assert.ok(new Set(calls.map(call=>call.owner)).size>1);
 assert.equal(calls.length,new Set(calls.map(call=>call.owner)).size*4);
});
test('RPC failure is not returned as an empty membership list',async()=>{
 const api=load({getProgramAccounts:async()=>{throw Error('RPC unavailable');}});
 await assert.rejects(api.getTokenOwnerRecordsByOwnerAcrossProgramsIndexed(wallet.toBase58()),/RPC unavailable/);
});
