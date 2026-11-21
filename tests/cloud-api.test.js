const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function makeClient(responses) {
  const calls=[]; const values=new Map();
  const context=vm.createContext({window:{SUN_CONFIG:{url:'https://example.invalid',publishableKey:'public-test'}},sessionStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},fetch:async(url,opts)=>{calls.push({url,opts});const item=responses.shift();if(!item)throw Error('unexpected request');return {ok:item.ok!==false,status:item.status||200,json:async()=>item.body};},Error,JSON});
  vm.runInContext(fs.readFileSync('public/supabase-api.js','utf8'),context);
  return {context,calls,values};
}

test('customer order sends items to server for validation and pricing',async()=>{
  const c=makeClient([{body:42}]);
  const result=await vm.runInContext("api('order',{requestId:'be897774-4090-4c55-b7af-46eb6f1fd419',table:'3',customer:'',note:'',items:[{id:1,qty:2}]})",c.context);
  assert.equal(result.id,42);assert.match(c.calls[0].url,/\/rpc\/place_order_once$/);
  assert.equal(JSON.parse(c.calls[0].opts.body).p_request_id,'be897774-4090-4c55-b7af-46eb6f1fd419');
  assert.deepEqual(JSON.parse(c.calls[0].opts.body).p_items,[{id:1,qty:2}]);
  assert.equal(c.calls[0].opts.headers.Authorization,undefined);
});

test('cashier login obtains role and menu mutation goes to RPC',async()=>{
  const c=makeClient([{body:{access_token:'token'}},{body:'cashier'},{body:null}]);
  await vm.runInContext("api('login',{email:'cashier@example.test',password:'example'})",c.context);
  await vm.runInContext("api('menu',{name:'Rice',price:50})",c.context);
  assert.match(c.calls[2].url,/\/rpc\/manage_menu$/);
  assert.equal(c.calls[2].opts.headers.Authorization,'Bearer token');
  assert.equal(JSON.parse(c.calls[2].opts.body).p_price,50);
});

test('authenticated user without staff role cannot use staff interface',async()=>{
  const c=makeClient([{body:{access_token:'token'}},{body:null}]);
  await assert.rejects(vm.runInContext("api('login',{email:'x',password:'y'})",c.context));
  assert.equal(c.values.has('sunAccessToken'),false);
});

test('cashier attaches and retrieves a slip through authenticated RPCs',async()=>{
  const c=makeClient([{body:{access_token:'token'}},{body:'cashier'},{body:null},{body:'image-data'}]);
  await vm.runInContext("api('login',{email:'cashier@example.test',password:'example'})",c.context);
  await vm.runInContext("api('paid-with-slip',{id:9,image:'image-data'})",c.context);
  const image=await vm.runInContext("api('payment-slip',{id:9})",c.context);
  assert.equal(image,'image-data');
  assert.match(c.calls[2].url,/\/rpc\/mark_order_paid_with_slip$/);
  assert.deepEqual(JSON.parse(c.calls[2].opts.body),{p_id:9,p_image:'image-data'});
  assert.equal(c.calls[3].opts.headers.Authorization,'Bearer token');
  assert.match(c.calls[3].url,/\/rpc\/get_payment_slip$/);
});
