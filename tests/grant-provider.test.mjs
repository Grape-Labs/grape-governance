import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configuredKeys,providerRequest} from '../src/server/grants/provider.js';

test('uses only REACT_APP_API_HELIUS and ignores all alternatives',()=>{
 const alternatives={GRANT_TRACKING_HELIUS_API_KEY:'alternate',HELIUS_API_KEY:'alternate',REACT_APP_API_HELIUS_BKP2:'backup',REACT_APP_API_HELIUS_BKP3:'backup',REACT_APP_API_HELIUS_BKP4:'backup',HELIUS_RPC_URL:'https://mainnet.helius-rpc.com/?api-key=backup',REACT_APP_API_HELIUS_RPC_ENDPOINT:'https://mainnet.helius-rpc.com/?api-key=backup'};
 assert.deepEqual(configuredKeys({...alternatives,REACT_APP_API_HELIUS:' primary '}),['primary']);
 assert.deepEqual(configuredKeys(alternatives),[]);
 assert.deepEqual(configuredKeys({...alternatives,REACT_APP_API_HELIUS:'  '}),[]);
});

test('handles failures and success without falling back to another key',async()=>{
 const previous=process.env.REACT_APP_API_HELIUS;
 const backup=process.env.REACT_APP_API_HELIUS_BKP4;
 const originalFetch=globalThis.fetch;
 try {
  delete process.env.REACT_APP_API_HELIUS;
  process.env.REACT_APP_API_HELIUS_BKP4='must-not-be-used';
  await assert.rejects(providerRequest('history',k=>k),{code:'PROVIDER_NOT_CONFIGURED'});
  process.env.REACT_APP_API_HELIUS='primary';
  let calls=0;
  globalThis.fetch=async key=>{calls++;assert.equal(key,'primary');return {ok:false,status:403};};
  await assert.rejects(providerRequest('history',k=>k),{code:'PROVIDER_ACCESS_DENIED'});
  assert.equal(calls,1);
  globalThis.fetch=async()=>({ok:false,status:429});
  await assert.rejects(providerRequest('history',k=>k),{code:'PROVIDER_RATE_LIMITED'});
  globalThis.fetch=async()=>{const e=new Error();e.name='TimeoutError';throw e;};
  await assert.rejects(providerRequest('history',k=>k),{code:'PROVIDER_TIMEOUT'});
  globalThis.fetch=async()=>({ok:true,json:async()=>[]});
  assert.deepEqual(await providerRequest('history',k=>k),[]);
  globalThis.fetch=async()=>({ok:true,json:async()=>({result:{value:[]}})});
  assert.deepEqual(await providerRequest('balance',k=>k),{result:{value:[]}});
  delete process.env.REACT_APP_API_HELIUS;
  await assert.rejects(providerRequest('balance',k=>k),{code:'PROVIDER_NOT_CONFIGURED'});
 } finally {
  globalThis.fetch=originalFetch;
  if(previous===undefined)delete process.env.REACT_APP_API_HELIUS;else process.env.REACT_APP_API_HELIUS=previous;
  if(backup===undefined)delete process.env.REACT_APP_API_HELIUS_BKP4;else process.env.REACT_APP_API_HELIUS_BKP4=backup;
 }
});
