const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {prepareDependencyTree}=require('../bin/prepare-dependency-tree.cjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'grape-dependency-cache-'));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:{'@solana/web3.js':'1.98.4'}}));
 const add=(relative,version)=>{const directory=path.join(root,'node_modules',relative);fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({version}));return directory;};
 add('@solana/web3.js','1.98.4');return {root,add};
}
test('removes stale SDKs restored beneath Helium and Jupiter without touching current packages',()=>{
 const {root,add}=fixture();
 try{
  const helium=add('@helium/anchor-resolvers/node_modules/@solana/web3.js','1.75.0');
  const jupiter=add('@jup-ag/dca-sdk/node_modules/@solana/web3.js','1.87.6');
  const current=add('other/node_modules/@solana/web3.js','1.98.4');
  const unrelated=add('@helium/anchor-resolvers/node_modules/other','1.0.0');
  const result=prepareDependencyTree(root);assert.equal(result.removed.length,2);
  assert.equal(fs.existsSync(helium),false);assert.equal(fs.existsSync(jupiter),false);
  assert.equal(fs.existsSync(current),true);assert.equal(fs.existsSync(unrelated),true);
  assert.equal(prepareDependencyTree(root).removed.length,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('fails clearly if the root SDK does not match the pinned dependency',()=>{
 const {root,add}=fixture();try{add('@solana/web3.js','1.75.0');assert.throws(()=>prepareDependencyTree(root),/Expected pinned/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('webpack aliases browser and server SDK imports to the patched root',async()=>{
 const {default:config}=await import('../next.config.mjs');
 const webpack={resolve:{alias:{}},module:{rules:[]}};
 config.webpack(webpack,{isServer:true});
 assert.equal(webpack.resolve.alias['@solana/web3.js'],path.dirname(require.resolve('@solana/web3.js/package.json')));
 assert.equal(require('../package.json').engines.node,'24.x');
 assert.match(require('../package.json').scripts.build,/prepare-dependency-tree/);
});
