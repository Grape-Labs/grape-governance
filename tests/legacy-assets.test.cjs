const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {transformSync} = require('@babel/core');
const {JSDOM} = require('jsdom');
function load(file, mocks = {}) {
  const mod = {exports:{}};
  const code = transformSync(fs.readFileSync(file,'utf8'), {filename:file, configFile:false, babelrc:false,
    presets:['@babel/preset-typescript'], plugins:['@babel/plugin-transform-modules-commonjs']}).code;
  new Function('module','exports','require',code)(mod,mod.exports,id => {
    if (id in mocks) return mocks[id];
    if (id.endsWith('.png')) return '/assets/'+id.split('/').pop();
    return require(id);
  });
  return mod.exports;
}
const assets = load('src/utils/legacyAssets.ts');
const oldBanner = 'https://shdw-drive.genesysgo.net/4HMWqo1YLwnxuVbh4c8KXMcZvQj4aw7oxnNmWVm4RmVV/Screenshot_2023-05-28_at_10.43.34.png';
test('exact known URLs use their replacements while unrelated files remain untouched', () => {
  assert.equal(assets.replaceLegacyAssetUrl(oldBanner+'?w=500#image'),'https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs?w=500#image');
  for (const url of [oldBanner.replace('/4HMW','/Other'),oldBanner.replace('.net/','.net.evil/'),'https://other.example/a.png'])
    assert.equal(assets.replaceLegacyAssetUrl(url),url);
  const markdown = `![GRAPE](${oldBanner})\n[Banner](${oldBanner}?raw=1)\n<img src="${oldBanner}">`;
  assert.equal(assets.replaceLegacyAssetsInText(markdown), '![GRAPE](https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs)\n[Banner](https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs?raw=1)\n<img src="https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs">');
});
test('page and raw Gist descriptions share asset replacement without nesting Markdown images', async () => {
  const body = `![GRAPE](${oldBanner})`;
  const github = load('src/utils/grapeTools/github.ts', {
    '../legacyAssets': assets,
    axios:{get:async url => url.includes('api.github.com')
      ? {status:200,data:{files:{'proposal.md':{filename:'proposal.md',raw_url:'https://gist.githubusercontent.com/user/id/raw/proposal.md'}}}}
      : {data:body}},
  });
  for (const url of ['https://gist.github.com/user/id','https://gist.githubusercontent.com/user/id/raw/proposal.md'])
    assert.equal(await github.resolveProposalDescription(url),'![GRAPE](https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs)');
});
test('network guards replace known GET and DOM URLs and keep unknown and write requests blocked', async () => {
  const dom = new JSDOM('',{url:'https://governance.so'});
  global.window = dom.window; global.Element = dom.window.Element;
  const calls=[];
  global.fetch=async (input,init) => {calls.push({input,init});return new Response('ok');};
  let interceptor;
  const guards=load('src/utils/networkGuards.ts',{'./legacyAssets':assets,
    axios:{interceptors:{request:{use:fn=>{interceptor=fn;return 0;}}}}});
  guards.installNetworkGuards();
  const image=dom.window.document.createElement('img');image.setAttribute('src',oldBanner);
  assert.equal(image.getAttribute('src'),'https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs');
  image.setAttribute('src','https://shdw-drive.genesysgo.net/unknown.png');assert.equal(image.getAttribute('src'),'');
  await fetch(oldBanner);assert.equal(calls.at(-1).input,'https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs');
  await fetch(new URL(oldBanner));assert.equal(calls.at(-1).input,'https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs');
  await fetch(new Request(oldBanner,{headers:{'X-Test':'preserved'}}));
  assert.equal(calls.at(-1).input.url,'https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs');
  assert.equal(calls.at(-1).input.headers.get('X-Test'),'preserved');
  assert.equal((await fetch(oldBanner,{method:'POST'})).status,503);
  assert.equal((await fetch('https://shdw-drive.genesysgo.net/unknown.json')).status,503);
  const config=await interceptor({url:oldBanner,method:'get'});assert.equal(config.url,'https://arweave.net/we4jVEAr0Ary_gslil-YtQmU7O0X4AJjAdMpJCulCjs');
  await assert.rejects(interceptor({url:oldBanner,method:'delete'}),{code:'HOST_BLOCKED'});
  await assert.rejects(interceptor({url:'https://shadow-storage.genesysgo.net/storage-account-info',method:'post'}),{code:'HOST_BLOCKED'});
  assert.equal(calls.length,3);
  dom.window.close();
});
