import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createParticipatingDaoCache} from '../src/Governance/participatingDaoCache.js';
const membership = (realm, failedPrograms=[]) => ({records:realm ? [{account:{realm}}] : [],failedPrograms});
test('persists wallet memberships across reloads and separates wallets and endpoints', async()=>{
 const data = new Map(); const storage=()=>({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)});
 let calls=0; const fetch=async()=>{calls++;return membership('dao');};
 const first=createParticipatingDaoCache({storage});
 await first.load('alice','mainnet',fetch);
 const second=createParticipatingDaoCache({storage});
 assert.equal((await second.load('alice','mainnet',fetch)).records[0].account.realm,'dao');
 assert.equal(calls,1);
 await second.load('bob','mainnet',fetch);await second.load('alice','devnet',fetch);
 assert.equal(calls,3);
});
test('coalesces concurrent loads, expires, and supports forced refresh including empty results',async()=>{
 let time=1000,calls=0;
 const cache=createParticipatingDaoCache({storage:()=>null,now:()=>time});
 const fetch=async()=>{calls++;return membership('dao');};
 await Promise.all([cache.load('a','rpc',fetch),cache.load('a','rpc',fetch)]);
 assert.equal(calls,1);
 time+=15*60*1000;assert.equal(cache.read('a','rpc').fresh,false);
 await cache.load('a','rpc',fetch);assert.equal(calls,2);
 await cache.load('a','rpc',async()=>membership(null),true);
 assert.deepEqual(cache.read('a','rpc').records,[]);
});
test('partial scans retain known DAOs, retry sooner, and failures preserve cache',async()=>{
 let time=1000;
 const cache=createParticipatingDaoCache({storage:()=>{throw Error('disabled');},now:()=>time});
 await cache.load('a','rpc',async()=>membership('one'));
 await cache.load('a','rpc',async()=>membership('two',['failed-program']),true);
 assert.equal(cache.read('a','rpc').records.length,2);
 time+=60000;assert.equal(cache.read('a','rpc').fresh,false);
 await assert.rejects(cache.load('a','rpc',async()=>{throw Error('offline');}));
 assert.equal(cache.read('a','rpc').records.length,2);
 await cache.load('a','rpc',async()=>membership('two'));
 assert.equal(cache.read('a','rpc').records.length,1);
});
