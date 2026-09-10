const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const {JSDOM} = require('jsdom');
const {transformSync} = require('@babel/core');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'https://governance.so',pretendToBeVisual:true});
for (const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','DocumentFragment','Node','Event','KeyboardEvent','MouseEvent','localStorage']) {
  global[name] = dom.window[name];
}
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const React = require('react');
const {render,fireEvent,screen,cleanup} = require('@testing-library/react');
const filename = path.resolve('src/Governance/CreateGist.tsx');
const compiled = transformSync(fs.readFileSync(filename,'utf8'), {
  filename, configFile:false, babelrc:false,
  presets:['@babel/preset-typescript','@babel/preset-react'],
  plugins:['@babel/plugin-transform-modules-commonjs'],
}).code;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = loaded.require.bind(loaded);
loaded.require = id => id === '../utils/grapeTools/constants' ? {APP_GITHUB_CLIENT_ID:'test'} : originalRequire(id);
loaded._compile(compiled,filename);
const CreateGist = loaded.exports.default;

test('Gist editor isolates typing from ancestor shortcuts without cancelling browser editing',async()=>{
  const originalFetch = global.fetch;
  localStorage.setItem('github_token','test');
  global.fetch = async()=>({ok:true,json:async()=>[]});
  let ancestorCalls = 0;
  try {
    render(React.createElement('div',{
      onKeyDown:event=>{ancestorCalls++;event.preventDefault();document.getElementById('outside').focus();},
      onKeyUp:()=>ancestorCalls++,
    },React.createElement('button',{id:'outside'},'Outside'),React.createElement(CreateGist,{onGistCreated:()=>{}})));
    fireEvent.click(screen.getByRole('button',{name:'+ Gist'}));
    const snippet = screen.getByRole('textbox',{name:'Code Snippet'});
    snippet.focus();
    for(const key of 'abcdefghijklmnopqrstuvwxyz') {
      assert.equal(fireEvent.keyDown(snippet,{key}),true);
      fireEvent.change(snippet,{target:{value:snippet.value+key}});
      fireEvent.keyUp(snippet,{key});
      assert.equal(document.activeElement,snippet);
    }
    for (const key of ['a','c','v','x','z']) {
      assert.equal(fireEvent.keyDown(snippet,{key,ctrlKey:true}),true);
      assert.equal(fireEvent.keyDown(snippet,{key,metaKey:true}),true);
    }
    assert.equal(fireEvent.keyDown(snippet,{key:'Tab'}),true);
    assert.equal(ancestorCalls,0);
    assert.equal(snippet.value,'abcdefghijklmnopqrstuvwxyz');
    assert.ok(screen.getByRole('dialog'));
  } finally {cleanup();global.fetch=originalFetch;localStorage.clear();}
});
