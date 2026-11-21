const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

test('realtime broadcasts no order data, notifies listeners, and rejoins after reconnect',()=>{
  const sockets=[];let timer=0;const timers=new Map();
  class FakeSocket {static OPEN=1;constructor(url){this.url=url;this.readyState=1;this.sent=[];sockets.push(this)}send(s){this.sent.push(JSON.parse(s))}close(){this.readyState=3;this.onclose?.()}}
  const context=vm.createContext({window:{SUN_CONFIG:{url:'https://example.test',publishableKey:'sb_publishable_test'}},WebSocket:FakeSocket,URL,URLSearchParams,Date,JSON,setInterval:()=>++timer,clearInterval:()=>{},setTimeout:fn=>{timers.set(++timer,fn);return timer},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync('public/live.js','utf8'),context);let updates=0;context.window.sunLive.start(()=>updates++);
  const first=sockets[0];first.onopen();assert.equal(first.sent[0][3],'phx_join');assert.equal(first.sent[0][0],first.sent[0][1]);
  first.onmessage({data:JSON.stringify(['1','1','realtime:sun-midnight-updates','phx_reply',{status:'ok'}])});
  context.window.sunLive.notify();assert.deepEqual(JSON.parse(JSON.stringify(first.sent.at(-1)[4].payload)),{});
  first.onmessage({data:JSON.stringify([null,null,'realtime:sun-midnight-updates','broadcast',{event:'changed',payload:{}}])});assert.equal(updates,1);
  first.close();[...timers.values()].at(-1)();const second=sockets[1];second.onopen();const join=second.sent[0];assert.equal(join[0],join[1]);
  second.onmessage({data:JSON.stringify([join[0],join[1],join[2],'phx_reply',{status:'ok'}])});context.window.sunLive.notify();assert.equal(second.sent.at(-1)[3],'broadcast');
});
