const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('double click sends one request and retry reuses the request ID',async()=>{
  const app={innerHTML:''},notice={textContent:''},label={textContent:''},name={value:'Tester'},button={disabled:false,textContent:''};let release;const gate=new Promise(r=>{release=r});const requests=[];let ids=0;
  const document={visibilityState:'visible',addEventListener(){},querySelector(s){return ({'#app':app,'#notice':notice,'#table-label':label,'#customer':name,'#submit-order':button,'#customer-view':{}})[s]||null}};
  const fetch=async(path,opts)=>{if(path.endsWith('/info'))return {ok:true,json:async()=>({role:null})};if(path.endsWith('/menu'))return {ok:true,json:async()=>[{id:1,name:'Test',price:50,available:true}]};if(path.endsWith('/order')){requests.push(JSON.parse(opts.body));if(requests.length===1){await gate;return {ok:false,json:async()=>({error:'network'})}}return {ok:true,json:async()=>({id:123})}}throw Error('unexpected request')};
  const ctx=vm.createContext({document,window:{},location:{search:'?table=1'},URLSearchParams,crypto:{randomUUID(){ids++;return 'be897774-4090-4c55-b7af-46eb6f1fd419'}},fetch,setInterval(){},setTimeout(){return 1},clearTimeout(){},Date,JSON});
  vm.runInContext(fs.readFileSync('public/app.js','utf8'),ctx);await new Promise(setImmediate);ctx.window.change(1,1);
  const a=ctx.window.submitOrder(),b=ctx.window.submitOrder();assert.equal(requests.length,1);assert.equal(button.disabled,true);release();await Promise.all([a,b]);assert.equal(button.disabled,false);await ctx.window.submitOrder();assert.equal(requests.length,2);assert.equal(requests[0].requestId,requests[1].requestId);assert.equal(ids,1);
});
