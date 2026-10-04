const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {transformSync}=require('@babel/core');
const filename=path.resolve('src/Governance/CachedStorageHelpers.tsx');
const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));
const base=loaded.require.bind(loaded);
loaded.require=id=>id==='../utils/grapeTools/constants'?{GGAPI_STORAGE_URI:'https://storage.example.test'}:base(id);
loaded._compile(transformSync(fs.readFileSync(filename,'utf8').replaceAll('import.meta.url',JSON.stringify('https://app.example.test/helpers.js')),{filename,configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);
test('directory prefers the network snapshot over the bundled file',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url)=>{
  calls.push(String(url));
  return new Response(JSON.stringify([{governanceAddress:'fresh'}]));
 });
 const result=await loaded.exports.fetchGovernanceLookupFile('pool');
 assert.equal(result[0].governanceAddress,'fresh');
 assert.equal(calls.length,1);
 assert.ok(calls[0].startsWith('https://storage.example.test/pool/governance_lookup.json'));
});
test('unavailable network uses the bundled fallback',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url)=>{
  calls.push(String(url));
  return String(url).startsWith('https://storage.example.test')?new Response('',{status:503}):new Response(JSON.stringify([{governanceAddress:'fallback'}]));
 });
 const result=await loaded.exports.fetchGovernanceLookupFile('pool');
 assert.equal(result[0].governanceAddress,'fallback');
 assert.equal(calls.length,2);
});
