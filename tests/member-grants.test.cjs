const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {JSDOM}=require('jsdom');
const {transformSync}=require('@babel/core');
const dom=new JSDOM('<html><body></body></html>',{url:'https://governance.so',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','DocumentFragment','Node','Event','MouseEvent'])global[key]=dom.window[key];
global.getComputedStyle=dom.window.getComputedStyle;
global.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
const React=require('react');
const {render,fireEvent,screen,waitFor,cleanup}=require('@testing-library/react');
const filename=path.resolve('src/Governance/Members/GrantTrackingView.tsx');
const compiled=transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code;
const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded._compile(compiled,filename);
const GrantTracking=loaded.exports.default;
const wallet='11111111111111111111111111111111';

test('loads grants into existing member cells and opens activity without a second recipient list',async()=>{
 const originalFetch=global.fetch;
 let pages=0;
 global.fetch=async url=>{
   const query=new URL(url,'https://governance.so').searchParams;
   let body;
   if(query.get('mode')==='payments') {
     pages++;
     body={rows:[{id:`grant${pages}`,signature:`signature${pages}`,recipient:wallet,timestamp:100,amount:pages===1?'100':'50',kind:'governance deposit'}],next:pages===1?'older':null,scanned:100,oldest:100};
   } else if(query.get('mode')==='recipient')body={rows:[],next:null};
   else if(query.get('mode')==='governance')body={changes:[],snapshot:{slot:100,decimals:0,position:'0'},next:null};
   else body={balance:'0'};
   return {ok:true,json:async()=>body};
 };
 try {
   render(React.createElement(GrantTracking,{mint:wallet,realm:wallet,grantors:[wallet],loadWallets:async()=>[]},cell=>
     React.createElement('table',{'aria-label':'Members'},React.createElement('tbody',null,React.createElement('tr',null,
       React.createElement('td',null,'Member'),React.createElement('td',null,'1,000 governance tokens'),React.createElement('td',null,cell(wallet)))))));
   assert.ok(screen.getByText('Not loaded'));
   fireEvent.click(screen.getByText('Load member grants'));
   fireEvent.click(screen.getByRole('button',{name:'Find grants'}));
   const action=await screen.findByRole('button',{name:`View grants and activity for ${wallet}`});
   assert.match(action.textContent,/100/);
   assert.equal(screen.getAllByRole('table').length,1);
   fireEvent.click(screen.getByRole('button',{name:'Load older grants'}));
   await waitFor(()=>assert.match(action.textContent,/150/));
   fireEvent.click(action);
   assert.ok(await screen.findByRole('dialog'));
   assert.ok(screen.getByText('Wallet activity'));
   fireEvent.click(screen.getByRole('button',{name:'Close activity'}));
   await waitFor(()=>assert.ok(!screen.queryByRole('dialog')));
   assert.match(screen.getByRole('button',{name:`View grants and activity for ${wallet}`}).textContent,/150/);
 }finally{cleanup();global.fetch=originalFetch;}
});
