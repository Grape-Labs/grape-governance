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
   fireEvent.change(screen.getByLabelText('Swap review threshold (%)'),{target:{value:'30'}});
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
   fireEvent.click(screen.getByText('Load member grants'));
   fireEvent.click(screen.getByRole('button',{name:'Find grants'}));
   await screen.findByText('25.00% less staked');
   assert.match(screen.getByTestId('stake0').textContent,/100.00% less staked/);
   for(const i of [2,3,4])assert.doesNotMatch(screen.getByTestId(`stake${i}`).textContent,/less staked/);
   assert.match(screen.getByTestId('stake5').textContent,/<0.01% less staked/);
   fireEvent.click(screen.getByRole('button',{name:'Load older grants'}));
   await waitFor(()=>assert.match(screen.getByTestId('stake1').textContent,/62.50% less staked/));
   assert.match(screen.getByTestId('stake2').textContent,/50.00% less staked/);
   assert.match(screen.getByTestId('stake3').textContent,/25.00% less staked/);
   assert.doesNotMatch(screen.getByTestId('stake4').textContent,/less staked/);
 }finally{cleanup();global.fetch=originalFetch;}
});
