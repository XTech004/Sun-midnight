const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('cashier can see paid order history separately from unpaid orders',async()=>{
  const app={innerHTML:''},notice={textContent:''},tableLabel={textContent:''},active={innerHTML:''},history={innerHTML:''};
  const elements={'#app':app,'#notice':notice,'#table-label':tableLabel,'#orders-list':active,'#order-history':history};
  const document={visibilityState:'visible',addEventListener(){},querySelector(s){return elements[s]||null}};
  const orders=[{id:12,table_no:'2',customer:'มานี',paid:true,status:'ready',note:'เผ็ดน้อย',created_at:'2026-01-01T00:00:00Z',items:[{name:'ตำไทย',qty:1,price:39}]},{id:13,table_no:'3',customer:'สมชาย',paid:false,status:'new',note:'',created_at:'2026-01-01T00:00:00Z',items:[{name:'ชาบู',qty:2,price:89}]}];
  const fetch=async path=>({ok:true,json:async()=>path.endsWith('/info')?{role:'cashier'}:path.endsWith('/menu')||path.endsWith('/payment-requests')?[]:path.endsWith('/orders')?orders:{}});
  const context=vm.createContext({document,window:{},location:{search:'?staff=1'},URLSearchParams,fetch,setInterval(){},setTimeout(){return 1},clearTimeout(){},Date,JSON});
  vm.runInContext(fs.readFileSync('public/app.js','utf8'),context);await new Promise(setImmediate);
  assert.match(app.innerHTML,/ประวัติรายการที่ชำระแล้ว/);assert.match(active.innerHTML,/ออเดอร์ #13/);assert.doesNotMatch(active.innerHTML,/ออเดอร์ #12/);
  assert.match(history.innerHTML,/ออเดอร์ #12/);assert.match(history.innerHTML,/มานี/);assert.match(history.innerHTML,/เผ็ดน้อย/);assert.doesNotMatch(history.innerHTML,/ออเดอร์ #13/);
});
