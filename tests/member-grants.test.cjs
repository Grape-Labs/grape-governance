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
const cacheFilename=path.resolve('src/Governance/Members/grantHistoryCache.js');
const cacheModule=new Module(cacheFilename,module);cacheModule.filename=cacheFilename;
cacheModule._compile(transformSync(fs.readFileSync(cacheFilename,'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,cacheFilename);
require.cache[cacheFilename]=cacheModule;
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
   fireEvent.click(screen.getByText('Member grants'));
   fireEvent.click(screen.getByRole('button',{name:'Load grants'}));
   const action=await screen.findByRole('button',{name:`View grants and activity for ${wallet}`});
   assert.match(action.textContent,/100/);
   assert.equal(screen.getAllByRole('table').length,1);
   fireEvent.click(screen.getByRole('button',{name:'Load more history'}));
   await waitFor(()=>assert.match(action.textContent,/150/));
   fireEvent.click(action);
   assert.ok(await screen.findByRole('dialog'));
   assert.ok(screen.getByText('Wallet activity'));
   fireEvent.click(screen.getByRole('button',{name:'Close activity'}));
   await waitFor(()=>assert.ok(!screen.queryByRole('dialog')));
   assert.match(screen.getByRole('button',{name:`View grants and activity for ${wallet}`}).textContent,/150/);
 }finally{cleanup();global.fetch=originalFetch;}
});

test('reviews members without grants, changes the threshold, and expands the activity period',async()=>{
 const originalFetch=global.fetch;
 const periods=[];
 global.fetch=async url=>{
   const q=new URL(url,'https://governance.so').searchParams;
   let body={balance:'0'};
   if(q.get('mode')==='recipient'){periods.push(q.get('since'));body={rows:[],next:null,scanned:10};}
   if(q.get('mode')==='governance')body={changes:[],snapshot:{slot:100,decimals:0,position:'0'},next:null};
   return {ok:true,json:async()=>body};
 };
 try{
   render(React.createElement(GrantTracking,{mint:wallet,realm:wallet,grantors:[wallet],loadWallets:async()=>[]},cell=>React.createElement('div',null,cell(wallet))));
   fireEvent.change(screen.getByLabelText('Warning threshold (%)'),{target:{value:'30'}});
   fireEvent.click(screen.getByRole('button',{name:'Review activity'}));
   await screen.findByText('Swaps ≥30%');
   assert.ok(Number(periods[0])>1);
   fireEvent.change(screen.getByLabelText('Activity period'),{target:{value:'1'}});
   await waitFor(()=>assert.ok(periods.includes('1')));
   assert.ok(screen.getByText('Recent voting · 0 recorded votes'));
 }finally{cleanup();global.fetch=originalFetch;}
});


test('flags loaded grant shortfalls and recalculates when older grants load',async()=>{
 const originalFetch=global.fetch;
 let page=0;
 global.fetch=async()=>({ok:true,json:async()=>({rows:[{id:`grant${++page}`,recipient:wallet,amount:'100',timestamp:100}],next:page===1?'older':null,scanned:100,oldest:100})});
 try{
   render(React.createElement(GrantTracking,{mint:wallet,realm:wallet,grantors:[wallet],loadWallets:async()=>[]},cell=>
     React.createElement('div',null,...[0,75,100,150,undefined,'99.999'].map((stake,i)=>React.createElement('div',{'data-testid':`stake${i}`,key:i},cell(wallet,stake))))));
   assert.equal(screen.queryByText(/less staked/),null);
   fireEvent.click(screen.getByText('Member grants'));
   fireEvent.click(screen.getByRole('button',{name:'Load grants'}));
   await screen.findByText('25.00% less staked');
   assert.equal(screen.getByLabelText('Warning threshold (%)').value,'30');
   assert.equal(screen.getByTestId('stake1').querySelector('[data-testid="WarningAmberIcon"]'),null);
   fireEvent.change(screen.getByLabelText('Warning threshold (%)'),{target:{value:'25'}});
   assert.ok(screen.getByTestId('stake1').querySelector('[data-testid="WarningAmberIcon"]'));
   assert.match(screen.getByTestId('stake0').textContent,/100.00% less staked/);
   for(const i of [2,3,4])assert.doesNotMatch(screen.getByTestId(`stake${i}`).textContent,/less staked/);
   assert.match(screen.getByTestId('stake5').textContent,/<0.01% less staked/);
   fireEvent.click(screen.getByRole('button',{name:'Load more history'}));
   await waitFor(()=>assert.match(screen.getByTestId('stake1').textContent,/62.50% less staked/));
   assert.match(screen.getByTestId('stake2').textContent,/50.00% less staked/);
   assert.match(screen.getByTestId('stake3').textContent,/25.00% less staked/);
   assert.doesNotMatch(screen.getByTestId('stake4').textContent,/less staked/);
 }finally{cleanup();global.fetch=originalFetch;}
});

test('batch loads at most ten pages and stops when history ends',async()=>{
 const originalFetch=global.fetch;
 let calls=0;
 const cursors=[];
 global.fetch=async url=>{
   cursors.push(new URL(url,'https://governance.so').searchParams.get('before'));
   const page=++calls;
   return {ok:true,json:async()=>({rows:[{id:`g${page}`,recipient:wallet,amount:'10',timestamp:100}],next:page<13?`cursor${page}`:null,scanned:100,oldest:100})};
 };
 try{
   render(React.createElement(GrantTracking,{mint:wallet,realm:wallet,grantors:[wallet],loadWallets:async()=>[]},cell=>React.createElement('div',null,cell(wallet,0))));
   fireEvent.click(screen.getByText('Member grants'));
   fireEvent.click(screen.getByRole('button',{name:'Load grants'}));
   fireEvent.click(await screen.findByRole('button',{name:'Load next 10 pages'}));
   await waitFor(()=>assert.match(screen.getByRole('button',{name:`View grants and activity for ${wallet}`}).textContent,/110/));
   assert.equal(calls,11);
   assert.deepEqual(cursors,[null,...Array.from({length:10},(_,i)=>`cursor${i+1}`)]);
   fireEvent.click(screen.getByRole('button',{name:'Load next 10 pages'}));
   await screen.findByText('History loaded');
   assert.equal(calls,13);
   assert.equal(screen.queryByRole('button',{name:'Load next 10 pages'}),null);
 }finally{cleanup();global.fetch=originalFetch;}
});

test('restores saved history and cursor, refreshes new grants, and keeps older history on refresh failure',async()=>{
 const cache=require('../src/Governance/Members/grantHistoryCache.js');
 const originalRead=cache.readGrantHistory, originalWrite=cache.writeGrantHistory, originalFetch=global.fetch;
 const saved=new Map();
 cache.readGrantHistory=async key=>saved.get(key)||null;
 cache.writeGrantHistory=async(key,value)=>{saved.set(key,structuredClone(value));return true;};
 let calls=0, refresh=false, fail=false;
 const cursors=[];
 global.fetch=async url=>{
   calls++;
   const cursor=new URL(url,'https://governance.so').searchParams.get('before');
   cursors.push(cursor);
   if(fail)throw new Error('Offline');
   const id=refresh?(cursor?'g1':'new'):(cursor?'g2':'g1');
   return {ok:true,json:async()=>({rows:[{id,recipient:wallet,amount:'10',timestamp:100}],next:refresh?(cursor?'c1':'newCursor'):(cursor?'c2':'c1'),scanned:100,oldest:100})};
 };
 const mount=()=>render(React.createElement(GrantTracking,{mint:wallet,realm:wallet,grantors:[wallet],loadWallets:async()=>[]},cell=>React.createElement('div',null,cell(wallet,0))));
 try{
   mount();fireEvent.click(screen.getByText('Member grants'));fireEvent.click(screen.getByRole('button',{name:'Load grants'}));
   fireEvent.click(await screen.findByRole('button',{name:'Load more history'}));
   await screen.findByText('2 grants loaded');
   await waitFor(()=>assert.equal(saved.values().next().value.rows.length,2));
   cleanup();mount();fireEvent.click(screen.getByText('Member grants'));fireEvent.click(screen.getByRole('button',{name:'Load grants'}));
   await screen.findByText(/Restored history saved/);
   assert.equal(calls,2);
   assert.ok(screen.getByText('2 grants loaded'));
   refresh=true;fireEvent.click(screen.getByRole('button',{name:'Reload recent grants'}));
   await screen.findByText('3 grants loaded');
   assert.deepEqual(cursors.slice(-2),[null,'newCursor']);
   await waitFor(()=>assert.equal(saved.values().next().value.rows.length,3));
   assert.equal(saved.values().next().value.next,'c2');
   fail=true;fireEvent.click(screen.getByRole('button',{name:'Reload recent grants'}));
   await screen.findByText('Offline');
   assert.ok(screen.getByText('3 grants loaded'));
   assert.equal(saved.values().next().value.rows.length,3);
   fail=false;refresh=false;fireEvent.click(screen.getByRole('button',{name:'Load more history'}));
   await waitFor(()=>assert.equal(cursors.at(-1),'c2'));
 }finally{cleanup();global.fetch=originalFetch;cache.readGrantHistory=originalRead;cache.writeGrantHistory=originalWrite;}
});
