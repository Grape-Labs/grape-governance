import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzePayments,analyzeRecipient} from '../src/server/grants/analyze.js';
const transfer=(from,to,amount,mint='GRAPE')=>({fromUserAccount:from,toUserAccount:to,tokenAmount:amount,mint});
const tx=(signature,transfers,extra={})=>({signature,timestamp:200,tokenTransfers:transfers,...extra});

test('payments exclude self transfers, failed transactions, swaps and other mints',()=>{
 const grant=tx('grant',[transfer('treasury','alice',100),transfer('treasury','bob',50)]);
 const result=analyzePayments([grant,grant,
   tx('failed',[transfer('treasury','alice',99)],{transactionError:{error:'failed'}}),
   tx('self',[transfer('treasury','treasury',99)]),
   tx('other',[transfer('treasury','alice',99,'OTHER')]),
   tx('swap',[transfer('treasury','pool',99)],{type:'SWAP'}),
 ],'treasury','GRAPE');
 assert.deepEqual(result.map(r=>[r.recipient,r.amount]),[['alice','100'],['bob','50']]);
});

test('counts only wallet-specific GRAPE swap inputs and avoids counting swaps twice',()=>{
 const result=analyzeRecipient([tx('swap',[transfer('alice','pool',12.5),transfer('alice','bob',2)],{
   events:{swap:{tokenInputs:[{mint:'GRAPE',userAccount:'alice',rawTokenAmount:{tokenAmount:'12500000',decimals:6}}]}}
 })],'alice','GRAPE',100);
 assert.deepEqual(result.map(r=>[r.type,r.amount]),[['swap','12.5'],['transfer','2']]);
});

test('unrecognized swaps and other users swaps are transfers, not confirmed sales',()=>{
 const result=analyzeRecipient([tx('unknown',[transfer('alice','bob',3)],{type:'SWAP'}),tx('someoneElse',[transfer('alice','bob',4)],{
 events:{swap:{tokenInputs:[{mint:'GRAPE',userAccount:'bob',rawTokenAmount:{tokenAmount:'400',decimals:2}}]}}
 })],'alice','GRAPE',100);
 assert.deepEqual(result.map(r=>[r.type,r.amount]),[['transfer','3'],['transfer','4']]);
});

test('ignores prior activity, duplicate transactions, failed transactions, and internal transfers',()=>{
 const outgoing=tx('out',[transfer('alice','bob',5)]);
 const result=analyzeRecipient([outgoing,outgoing,
 tx('prior',[transfer('alice','bob',100)],{timestamp:50}),
 tx('failed',[transfer('alice','bob',100)],{transactionError:{err:true}}),
 tx('self',[transfer('alice','alice',100)]),
 tx('incoming',[transfer('bob','alice',100)]),
 ],'alice','GRAPE',100);
 assert.deepEqual(result.map(r=>r.amount),['5']);
});

test('API validates addresses before querying providers',async()=>{
 const {default:handler}=await import('../api/grant-tracking.js');
 const res={status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await handler({method:'GET',query:{wallet:'invalid',mint:'invalid',mode:'payments'}},res);
 assert.equal(res.code,400);
});

test('resolves governance deposits to members instead of the realm holding account',async()=>{
 const {default:bs58}=await import('bs58');
 const data=Buffer.alloc(9);data[0]=1;data.writeBigUInt64LE(5310000000n,1);
 const deposit={programId:'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',data:bs58.encode(data),accounts:['realm','holding','source','alice','treasury','record']};
 const row=tx('deposit',[{...transfer('treasury','realm',5310),fromTokenAccount:'source',toTokenAccount:'holding'}],{
 instructions:[{innerInstructions:[deposit]}],
 accountData:[{tokenBalanceChanges:[{mint:'GRAPE',tokenAccount:'source',rawTokenAmount:{decimals:6}}]}],
 });
 const result=analyzePayments([row],'treasury','GRAPE');
 assert.equal(result[0].recipient,'alice');
 assert.equal(result[0].kind,'governance deposit');
 assert.equal(result[0].amount,'5310');
 // An unrelated deposit instruction must not relabel a direct payment.
 row.tokenTransfers[0].toTokenAccount='another-account';
 assert.equal(analyzePayments([row],'treasury','GRAPE')[0].recipient,'realm');
});

test('API preserves history pagination and reports provider failures instead of zero activity',async()=>{
 const {default:handler}=await import('../api/grant-tracking.js');
 const originalFetch=globalThis.fetch;
 const originalKey=process.env.REACT_APP_API_HELIUS;
 process.env.REACT_APP_API_HELIUS='test-key';
 const wallet='11111111111111111111111111111111';
 const signature='1'.repeat(88);
 const response=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});
 try {
   globalThis.fetch=async()=>({ok:true,json:async()=>Array.from({length:100},(_,i)=>({signature:i===99?signature:`tx-${i}`,timestamp:1000-i,tokenTransfers:[]}))});
   const page=response();
   await handler({method:'GET',query:{mode:'payments',wallet,mint:wallet}},page);
   assert.equal(page.code,200);assert.equal(page.body.next,signature);assert.equal(page.body.scanned,100);
   const recipient=response();
   await handler({method:'GET',query:{mode:'recipient',wallet,mint:wallet,since:'950'}},recipient);
   assert.equal(recipient.body.next,null);
   globalThis.fetch=async()=>({ok:false});
   const failed=response();
   await handler({method:'GET',query:{mode:'recipient',wallet,mint:wallet,since:'950'}},failed);
   assert.equal(failed.code,502);assert.equal(failed.body.rows,undefined);
 } finally {
   globalThis.fetch=originalFetch;
   if(originalKey===undefined) delete process.env.REACT_APP_API_HELIUS;
   else process.env.REACT_APP_API_HELIUS=originalKey;
 }
});
