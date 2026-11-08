import {test, mock, after} from 'node:test';
import assert from 'node:assert/strict';
const keys=['API_KEY','AUTH_DOMAIN','PROJECT_ID','STORAGE_BUCKET','MESSAGING_SENDER_ID','APPID','VAPID_KEY'].map(key=>'REACT_APP_FIREBASE_'+key);
const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
for(const key of keys)process.env[key]='test-config';
const previousWindow=global.window;
global.window={};
let supported=false, messagingCalls=0, callback, unsubscribed=false;
mock.module('firebase/app',{namedExports:{initializeApp:()=>({})}});
mock.module('firebase/messaging',{namedExports:{
  isSupported:async()=>supported,
  getMessaging:()=>{messagingCalls++;return {};},
  getToken:async()=> 'test-token',
  onMessage:(_messaging, handler)=>{callback=handler;return()=>{unsubscribed=true;};},
}});
after(()=>{
  for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
  if(previousWindow===undefined)delete global.window;else global.window=previousWindow;
});
test('unsupported browsers do not initialize messaging or reject app startup',async()=>{
  const firebase=await import('../src/firebaseNotifications/firebase.js?unsupported');
  assert.equal(messagingCalls,0);
  assert.equal(typeof await firebase.listenForForegroundMessages(()=>{}),'function');
  assert.equal(await firebase.fetchToken(),null);
  assert.equal(messagingCalls,0);
});
test('supported browsers keep token and foreground-message behavior',async()=>{
  supported=true;
  const firebase=await import('../src/firebaseNotifications/firebase.js?supported');
  assert.equal(messagingCalls,0,'initialization stays lazy');
  assert.equal(await firebase.fetchToken(),'test-token');
  let received;
  const stop=await firebase.listenForForegroundMessages(payload=>{received=payload;});
  callback({notification:{title:'Proposal'}});
  assert.equal(received.notification.title,'Proposal');
  stop();assert.equal(unsubscribed,true);
  assert.equal(messagingCalls,1,'SDK initialization is reused');
});
