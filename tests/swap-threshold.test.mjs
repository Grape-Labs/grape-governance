import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessSwaps} from '../src/server/grants/swap-threshold.js';
const slot=200000000;
const tx=(signature,delta,offset=0)=>({signature,slot:slot-offset,
  accountData:[{tokenBalanceChanges:[{mint:'GRAPE',userAccount:'alice',rawTokenAmount:{tokenAmount:delta,decimals:0}}]}]});
const swap=(signature,amount)=>({signature,type:'swap',amount});

test('10% inclusive threshold uses holdings before each transaction, not the current balance',()=>{
 const result=assessSwaps([tx('second','-90'),tx('first','-100',1)],
 [swap('second','90'),swap('first','100')],'alice','GRAPE',{slot,balance:'810'});
 assert.deepEqual(result.rows.map(r=>[r.holdingsBefore,r.swapPercent,r.thresholdExceeded]),
 [['900','10',true],['1000','10',true]]);
});

test('out-and-back transfers restore holdings and do not become swap flags',()=>{
 const transactions=[tx('swap','-100'),tx('returned','800',1),tx('sent','-800',2)];
 const result=assessSwaps(transactions,[swap('swap','100'),{signature:'sent',type:'transfer',amount:'800'}],
 'alice','GRAPE',{slot,balance:'900'});
 assert.equal(result.rows[0].holdingsBefore,'1000');
 assert.equal(result.rows[0].thresholdExceeded,true);
 assert.equal(result.rows[1].thresholdExceeded,undefined);
 assert.equal(result.snapshot.balance,'1000');
});

test('pagination carries the anchored balance and ignores later snapshots',()=>{
 const first=assessSwaps([tx('new','-50')],[swap('new','50')],'alice','GRAPE',{slot,balance:'850'});
 const second=assessSwaps([tx('old','-100',1)],[swap('old','100')],'alice','GRAPE',first.snapshot);
 assert.equal(first.rows[0].thresholdExceeded,false);
 assert.equal(second.rows[0].holdingsBefore,'1000');
 assert.equal(second.rows[0].thresholdExceeded,true);
});

test('missing balance changes poison older assessments instead of implying a clean review',()=>{
 const result=assessSwaps([{signature:'gap',slot},tx('old','-100',1)],[swap('old','100')],
 'alice','GRAPE',{slot,balance:'900'});
 assert.equal(result.rows[0].thresholdExceeded,null);
 assert.equal(result.snapshot.balance,null);
});

test('unknown snapshots, invalid chronology, and impossible balances remain unavailable',()=>{
 for (const snapshot of [null,{slot:slot-1,balance:'900'},{slot,balance:'-1'}]) {
   const result=assessSwaps([tx('s','-100')],[swap('s','100')],'alice','GRAPE',snapshot);
   assert.equal(result.rows[0].thresholdExceeded,null);
 }
 const impossible=assessSwaps([tx('s','0')],[swap('s','100')],'alice','GRAPE',{slot,balance:'1'});
 assert.equal(impossible.rows[0].thresholdExceeded,null);
});

test('threshold comparison preserves precision immediately below 10%',()=>{
 const result=assessSwaps([tx('s','-99999999999999999')],[swap('s','99999999999999999')],
 'alice','GRAPE',{slot,balance:'900000000000000001'});
 assert.equal(result.rows[0].thresholdExceeded,false);
});

test('failed and duplicate transactions do not change reconstructed holdings',()=>{
 const s=tx('s','-100');
 const result=assessSwaps([{...tx('failed','-500'),transactionError:{error:'failed'}},s,s],
 [swap('s','100')],'alice','GRAPE',{slot,balance:'900'});
 assert.equal(result.snapshot.balance,'1000');
});

test('API anchors token-account history to a finalized balance and carries it across pages',async()=>{
 const {default:handler}=await import('../api/grant-tracking.js');
 const originalFetch=globalThis.fetch;
 const originalKey=process.env.REACT_APP_API_HELIUS;
 process.env.REACT_APP_API_HELIUS='test';
 const wallet='11111111111111111111111111111111';
 const signature='1'.repeat(88);
 const response=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});
 let historyUrl;
 try {
   globalThis.fetch=async(url,options)=>{
     if(options?.method==='POST') {
       assert.equal(JSON.parse(options.body).params[2].commitment,'finalized');
       return {ok:true,json:async()=>({result:{context:{slot},value:[{account:{data:{parsed:{info:{tokenAmount:{amount:'900',decimals:0}}}}}}]}})};
     }
     historyUrl=new URL(url);
     return {ok:true,json:async()=>[{
       signature,slot,timestamp:200,
       accountData:[{tokenBalanceChanges:[{mint:wallet,userAccount:wallet,rawTokenAmount:{tokenAmount:'-100',decimals:0}}]}],
       events:{swap:{tokenInputs:[{mint:wallet,userAccount:wallet,rawTokenAmount:{tokenAmount:'100',decimals:0}}]}},
     }]};
   };
   const res=response();
   await handler({method:'GET',query:{mode:'recipient',wallet,mint:wallet,since:'100'}},res);
   assert.equal(res.code,200);
   assert.equal(historyUrl.searchParams.get('lte-slot'),String(slot));
   assert.equal(historyUrl.searchParams.get('token-accounts'),'balanceChanged');
   assert.equal(res.body.rows[0].holdingsBefore,'1000');
   assert.equal(res.body.rows[0].thresholdExceeded,true);
   assert.equal(res.body.snapshot.balance,'1000');
   const page=response();
   await handler({method:'GET',query:{mode:'recipient',wallet,mint:wallet,since:'100',before:signature,balanceSlot:String(slot),balanceBefore:'1000'}},page);
   assert.equal(historyUrl.searchParams.get('before-signature'),signature);
   assert.equal(page.body.rows[0].holdingsBefore,'1100');
   assert.equal(page.body.rows[0].thresholdExceeded,false);
 } finally {
   globalThis.fetch=originalFetch;
   if(originalKey===undefined) delete process.env.REACT_APP_API_HELIUS;
   else process.env.REACT_APP_API_HELIUS=originalKey;
 }
});
