import {test} from 'node:test';
import assert from 'node:assert/strict';
import bs58 from 'bs58';
import {assessGovernanceSwaps} from '../src/server/grants/swap-threshold.js';
import {governanceChanges,GOVERNANCE_PROGRAM} from '../src/server/grants/governance-position.js';
const change=(kind,amount,slot)=>({id:`${slot}`,signature:`tx${slot}`,kind,amount,slot});
const swap=(amount,slot=30)=>({signature:`swap${slot}`,type:'swap',amount,slot});
const assess=(rows,changes,position='1000',complete=true)=>assessGovernanceSwaps(rows,changes,{slot:100,position},complete);

test('compares each swap to governance deposits, with an inclusive 10% boundary',()=>{
 const rows=assess([swap('99'),swap('100'),swap('101')],[change('deposit','1000',10)]);
 assert.deepEqual(rows.map(r=>r.thresholdExceeded),[false,true,true]);
 assert.deepEqual(rows.map(r=>r.governanceBasis),['1000','1000','1000']);
});
test('full withdrawal preserves the pre-withdrawal position when current governance balance is zero',()=>{
 const rows=assess([swap('100')],[change('withdraw','0',20),change('deposit','1000',10)],'0');
 assert.equal(rows[0].thresholdExceeded,true);
 assert.equal(rows[0].governanceBasis,'1000');
 assert.equal(rows[0].basisSignature,'tx20');
});
test('swaps larger than the governance position can exceed 100%',()=>{
 assert.equal(assess([swap('1200')],[change('deposit','1000',10)])[0].swapPercent,'120');
});
test('wallet transfers never set or change the governance denominator',()=>{
 const rows=assess([{type:'transfer',amount:'1000000',slot:25},swap('100')],[change('deposit','1000',10)]);
 assert.equal(rows[0].thresholdExceeded,undefined);
 assert.equal(rows[1].governanceBasis,'1000');
});
test('uses the position at the time, not a later deposit, and resets basis on redeposit',()=>{
 const changes=[change('deposit','500',40),change('withdraw','0',20),change('deposit','1000',10)];
 const rows=assess([swap('100',30),swap('100',50)],changes,'500');
 assert.deepEqual(rows.map(r=>r.swapPercent),['10','20']);
});
test('revocations reduce position without being treated as member swaps',()=>{
 assert.equal(assess([swap('50')],[change('revoke','500',20),change('deposit','1000',10)],'500')[0].swapPercent,'10');
});
test('partial or unreconciled histories are unavailable, never wallet-based fallbacks',()=>{
 const changes=[change('deposit','1000',10)];
 for(const [position,complete] of [['1000',false],['900',true]]) {
   assert.equal(assess([swap('100')],changes,position,complete)[0].thresholdExceeded,null);
 }
 assert.equal(assess([swap('100')],[change('unknown','0',20),...changes])[0].thresholdExceeded,null);
});
test('zero positions and ambiguous same-slot activity are unavailable',()=>{
 assert.equal(assess([swap('100')],[],'0')[0].thresholdExceeded,null);
 assert.equal(assess([swap('100',10)],[change('deposit','1000',10)])[0].thresholdExceeded,null);
});
test('does not round a sub-10% swap up to a violation',()=>{
 assert.equal(assess([swap('99999999999999999')],[change('deposit','1000000000000000000',10)],'1000000000000000000')[0].thresholdExceeded,false);
});
test('duplicate history entries do not double count deposits',()=>{
 const deposit=change('deposit','1000',10);
 assert.equal(assess([swap('100')],[deposit,deposit])[0].swapPercent,'10');
});

const addresses={record:'record',holding:'holding'};
const ix=(op,accounts,amount)=>{
 const data=Buffer.alloc(amount===undefined?1:9);data[0]=op;
 if(amount!==undefined)data.writeBigUInt64LE(BigInt(amount),1);
 return {programId:GOVERNANCE_PROGRAM,accounts,data:bs58.encode(data)};
};
test('decodes third-party governance grants, withdrawals, revocations and nested instructions',()=>{
 const transactions=[{signature:'tx',slot:10,instructions:[{innerInstructions:[
   ix(1,['realm','holding','source','member','grantor','record'],'1000000'),
   ix(2,['realm','holding','destination','member','record']),
   ix(26,['realm','holding','record','mint'],'500000'),
 ]}]}];
 const rows=governanceChanges(transactions,'realm','mint','member',addresses,3);
 assert.deepEqual(rows.map(r=>[r.kind,r.amount]),[['revoke','500'],['withdraw','0'],['deposit','1000']]);
});
test('failed transactions and other members cannot alter this governance position',()=>{
 const deposit=ix(1,['realm','holding','source','other','grantor','otherRecord'],'100');
 const rows=governanceChanges([{signature:'other',slot:10,instructions:[deposit]},
 {signature:'failed',slot:11,transactionError:{error:'failed'},instructions:[]}],'realm','mint','member',addresses,0);
 assert.equal(rows.length,0);
});
test('malformed or unsupported instructions touching the record invalidate the assessment',()=>{
 const rows=governanceChanges([{signature:'bad',slot:10,instructions:[{programId:GOVERNANCE_PROGRAM,accounts:['record'],data:'!'}]}],'realm','mint','member',addresses,0);
 assert.equal(rows[0].kind,'unknown');
});

test('API reads the DAO record (not wallet balances) and anchors paginated governance history',async()=>{
 const {default:handler}=await import('../api/grant-tracking.js');
 const {PublicKey}=await import('@solana/web3.js');
 const {Realm,RealmConfig,MintMaxVoteWeightSource,TokenOwnerRecord,GOVERNANCE_ACCOUNT_SCHEMA_V1}=await import('@solana/spl-governance');
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url);
 const {serialize}=createRequire(require.resolve('@solana/spl-governance'))('borsh');
 const {default:BN}=await import('bn.js');
 const {governanceAddresses}=await import('../src/server/grants/governance-position.js');
 const wallet='11111111111111111111111111111111';
 const realm='By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip';
 const mint='So11111111111111111111111111111111111111112';
 const zero=new BN(0);
 const realmData=new Realm({communityMint:new PublicKey(mint),config:new RealmConfig({councilMint:null,
   communityMintMaxVoteWeightSource:new MintMaxVoteWeightSource({type:0,value:zero}),
   minCommunityTokensToCreateGovernance:zero,reserved:Array(6).fill(0),
 }),reserved:Array(6).fill(0),votingProposalCount:0,authority:null,name:'Test DAO'});
 const recordData=new TokenOwnerRecord({realm:new PublicKey(realm),governingTokenMint:new PublicKey(mint),governingTokenOwner:new PublicKey(wallet),
   governingTokenDepositAmount:new BN(1000000),unrelinquishedVotesCount:0,totalVotesCount:0,outstandingProposalCount:0,version:0,governanceDelegate:null,reserved:Array(6).fill(0)});
 const info=account=>({owner:GOVERNANCE_PROGRAM,data:[Buffer.from(serialize(GOVERNANCE_ACCOUNT_SCHEMA_V1,account)).toString('base64'),'base64'],lamports:1,executable:false});
 const realmInfo=info(realmData), recordInfo=info(recordData);
 const mintData=Buffer.alloc(82);mintData[44]=3;
 const originalFetch=globalThis.fetch, originalKey=process.env.REACT_APP_API_HELIUS;
 process.env.REACT_APP_API_HELIUS='test';
 const address=governanceAddresses(realm,mint,wallet);
 const signature='1'.repeat(88);
 let urlSeen;
 const response=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});
 try {
   globalThis.fetch=async(url,options)=>{
     if(options?.method==='POST') {
       const body=JSON.parse(options.body);
       assert.equal(body.method,'getMultipleAccounts');
       assert.equal(body.params[0][2],address.record);
       return {ok:true,json:async()=>({result:{context:{slot:100},value:[realmInfo,
         {owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',data:[mintData.toString('base64'),'base64']},recordInfo,null]}})};
     }
     urlSeen=new URL(url);
     return {ok:true,json:async()=>[{signature,slot:10,instructions:[ix(1,[realm,address.holding,'source',wallet,'grantor',address.record],'1000000')]}]};
   };
   const res=response();
   await handler({method:'GET',query:{mode:'governance',wallet,mint,realm}},res);
   assert.equal(res.code,200,JSON.stringify(res.body));
   assert.equal(res.body.snapshot.position,'1000');
   assert.equal(res.body.changes[0].amount,'1000');
   assert.ok(urlSeen.pathname.includes(address.record));
   assert.equal(urlSeen.searchParams.get('lte-slot'),'100');
   const page=response();
   await handler({method:'GET',query:{mode:'governance',wallet,mint,realm,before:signature,positionSlot:'100',decimals:'3'}},page);
   assert.equal(page.code,200);
   assert.equal(urlSeen.searchParams.get('before-signature'),signature);
 } finally {
   globalThis.fetch=originalFetch;
   if(originalKey===undefined)delete process.env.REACT_APP_API_HELIUS;else process.env.REACT_APP_API_HELIUS=originalKey;
 }
});

test('a repeated zero withdrawal cannot erase the preserved governance position',()=>{
 const rows=assess([swap('100',40)],[change('withdraw','0',30),change('withdraw','0',20),change('deposit','1000',10)],'0');
 assert.equal(rows[0].governanceBasis,'1000');
 assert.equal(rows[0].thresholdExceeded,true);
});
