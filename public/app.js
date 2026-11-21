const app=document.querySelector('#app'),notice=document.querySelector('#notice');
let info=null,menu=[],cart={},itemOptions={},view=new URLSearchParams(location.search).get('staff')==='1'?'staff':'customer',orders=[],paymentRequests=[],loading=false;
const rawTable=new URLSearchParams(location.search).get('table');
const tableNo=rawTable && rawTable.trim().length<=20?rawTable.trim():'';
let customerName='';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Local server adapter is removed from the hosted build.
async function api(path,data){const r=await fetch('/api/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const v=await r.json();if(!r.ok)throw Error(v.error||'เกิดข้อผิดพลาด');return v}
let noticeTimer;
function msg(s,temporary=false){clearTimeout(noticeTimer);notice.textContent=s;if(temporary)noticeTimer=setTimeout(()=>{notice.textContent=''},3000)}
async function run(f){try{await f()}catch(e){msg(e.message)}}
function imageFor(name){if(/น้ำ|เครื่องดื่ม|ชา|กาแฟ/i.test(name))return 'drink';if(/ผัดไทย|เส้น|ก๋วยเตี๋ยว/i.test(name))return 'noodles';if(/กะเพรา|กระเพรา/i.test(name))return 'basil';return 'rice'}
function preserveForm(){const input=document.querySelector('#customer');if(input)customerName=input.value}
async function refresh(){
  if(loading)return;loading=true;
  try{
    const newInfo=await api('info');const newMenu=await api('menu');const newOrders=newInfo.role?await api('orders'):[];const newRequests=newInfo.role==='cashier'?await api('payment-requests'):[];
    const roleChanged=info?.role!==newInfo.role, menuChanged=JSON.stringify(menu)!==JSON.stringify(newMenu), ordersChanged=JSON.stringify(orders)!==JSON.stringify(newOrders);
    info=newInfo;menu=newMenu;orders=newOrders;paymentRequests=newRequests;
    if(view==='customer'){if(menuChanged||!document.querySelector('#customer-view')){preserveForm();customer()}}
    else if(roleChanged||!document.querySelector('#staff-view'))render();
    else if(info.role){if(ordersChanged)renderOrders();if(menuChanged&&info.role==='cashier')renderMenuAdmin();if(info.role==='cashier')renderPaymentRequests()}
  } finally {loading=false}
}
function render(){if(!info)return;document.querySelector('#table-label').textContent=view==='customer'?(tableNo?'โต๊ะ '+tableNo:'กรุณาสแกน QR ประจำโต๊ะ'):'';if(view==='customer')return customer();if(info.setup)return setup();if(!info.role)return login();dashboard()}
let customerPage='menu';
window.openSummary=()=>{preserveForm();customerPage='summary';customer();window.scrollTo?.(0,0)};
window.backToMenu=()=>{preserveForm();customerPage='menu';customer();window.scrollTo?.(0,0)};
function customer(){document.querySelector('#table-label').textContent=tableNo?'โต๊ะ '+tableNo:'กรุณาสแกน QR ประจำโต๊ะ';let total=0;
  const categoryOrder=['หมูกระทะและชาบู','ของทานเล่น','เมนูกับแกล้ม','เมนูตำและยำ','เครื่องเคียง','อื่น ๆ'];
  const activeMenu=menu.filter(m=>m.available);
  const categories=[...new Set(activeMenu.map(m=>m.category||'อื่น ๆ'))].sort((a,b)=>{const ai=categoryOrder.indexOf(a),bi=categoryOrder.indexOf(b);return (ai<0?categoryOrder.length:ai)-(bi<0?categoryOrder.length:bi)});
  const cards=categories.map(category=>{const categoryItems=activeMenu.filter(m=>(m.category||'อื่น ๆ')===category);const cardsForCategory=categoryItems.map(m=>`<article class="card food-card"><img class="food-image" src="/images/${imageFor(m.name)}.svg" alt="ภาพประกอบ ${esc(m.name)}"><div class="badge">พร้อมขาย</div><h3>${esc(m.name)}</h3><div class="row"><span class="price">฿${m.price}</span><button onclick="openItem(${m.id})">+ เพิ่ม</button></div></article>`).join('');return `<section class="menu-category"><h3>${esc(category)}</h3><div class="grid">${cardsForCategory}</div></section>`}).join('');
  const selected=menu.filter(m=>cart[m.id]).map(m=>{total+=m.price*cart[m.id];const opts=itemOptions[m.id]||{};const makeOptions=(values,current)=>values.map(([value,label])=>`<option value="${esc(value)}" ${value===(current||'')?'selected':''}>${esc(label)}</option>`).join('');return `<div class="order"><div class="row"><strong>${esc(m.name)}</strong><span>฿${m.price*cart[m.id]}</span></div><div class="row"><span>จำนวน ${cart[m.id]}</span><span><button onclick="change(${m.id},-1)" aria-label="ลดจำนวน ${esc(m.name)}">−</button> <button onclick="change(${m.id},1)" aria-label="เพิ่มจำนวน ${esc(m.name)}">+</button></span></div><label class="small">ระดับความเผ็ด<select aria-label="ระดับความเผ็ด ${esc(m.name)}" onchange="setOption(${m.id},'spice',this.value)">${makeOptions([['','ไม่ระบุ'],['ไม่เผ็ด','ไม่เผ็ด'],['เผ็ดน้อย','เผ็ดน้อย'],['เผ็ดปกติ','เผ็ดปกติ'],['เผ็ดมาก','เผ็ดมาก']],opts.spice)}</select></label><label class="small">รสชาติ<select aria-label="รสชาติ ${esc(m.name)}" onchange="setOption(${m.id},'taste',this.value)">${makeOptions([['','ไม่ระบุ'],['รสปกติ','รสปกติ'],['หวาน','หวาน'],['เปรี้ยว','เปรี้ยว'],['เค็ม','เค็ม']],opts.taste)}</select></label><p class="muted small">รายละเอียดนี้ใช้กับทุกจานของเมนูนี้ในออเดอร์</p></div>`}).join('');
  const count=Object.values(cart).reduce((sum,qty)=>sum+qty,0);
  app.innerHTML=`<div id="customer-view">${customerPage==='menu'?`<div class="cart-summary"><span>เลือกแล้ว <strong>${count} ชิ้น</strong></span><button type="button" class="summary-button" onclick="openSummary()">สรุปคำสั่งซื้อ</button></div><section><h2>เมนูอาหาร</h2><p class="muted">เลือกอาหารที่ต้องการได้เลย</p>${cards||'ยังไม่มีเมนูพร้อมขาย'}</section>`:`<section class="panel summary-page" id="cart-details"><button type="button" class="back-menu" onclick="backToMenu()">← กลับไปเลือกอาหาร</button><h2>รายการของคุณ</h2>${selected||'<p class="muted">ยังไม่มีรายการอาหาร</p>'}${tableNo?'':'<p class="muted small">กรุณาสแกน QR ประจำโต๊ะเพื่อเริ่มสั่งอาหาร</p>'}<label for="customer">ชื่อผู้สั่ง</label><input id="customer" maxlength="80" autocomplete="name" value="${esc(customerName)}" placeholder="กรุณากรอกชื่อ"><button id="submit-order" onclick="submitOrder()" ${tableNo?'':'disabled'}>ยืนยันส่งออเดอร์</button><p><button class="call-payment" onclick="requestPayment()" ${tableNo?'':'disabled'}>เรียกพนักงานเก็บเงิน</button></p></section>`}</div>`;
}
window.change=(id,n)=>{if(submittingOrder){msg('กำลังส่งออเดอร์ กรุณารอสักครู่',true);return}preserveForm();const before=cart[id]||0;cart[id]=Math.max(0,Math.min(99,before+n));if(!cart[id])delete itemOptions[id];customer();if(n>0&&cart[id]>before){const item=menu.find(m=>m.id===id);msg('เพิ่ม '+(item?.name||'สินค้า')+' ลงรายการแล้ว',true)}};
window.openItem=id=>{
  if(submittingOrder){msg('กำลังส่งออเดอร์ กรุณารอสักครู่',true);return}
  const item=menu.find(m=>m.id===id&&m.available);if(!item)return;
  preserveForm();const dialog=document.querySelector('#item-dialog');const current=itemOptions[id]||{};
  const options=(values,selected)=>values.map(value=>`<option value="${esc(value)}" ${value===(selected||'')?'selected':''}>${esc(value||'ไม่ระบุ')}</option>`).join('');
  dialog.innerHTML=`<div class="item-detail"><div class="row"><h2 id="item-title">${esc(item.name)}</h2><button class="close-detail" type="button" onclick="closeItem()" aria-label="ปิด">×</button></div><img class="detail-image" src="/images/${imageFor(item.name)}.svg" alt="ภาพประกอบ ${esc(item.name)}"><p class="price">฿${item.price} ต่อจาน</p><label>ระดับความเผ็ด<select id="detail-spice">${options(['','ไม่เผ็ด','เผ็ดน้อย','เผ็ดปกติ','เผ็ดมาก'],current.spice)}</select></label><label>รสชาติ<select id="detail-taste">${options(['','รสปกติ','หวาน','เปรี้ยว','เค็ม'],current.taste)}</select></label><label>จำนวน<input id="detail-qty" type="number" min="1" max="99" step="1" value="1" inputmode="numeric"></label><p class="muted small">รายละเอียดใช้ร่วมกันทุกจานของเมนูเดียวกันในออเดอร์</p><p id="detail-error" class="detail-error" role="alert"></p><button type="button" onclick="confirmItem(${item.id})">เพิ่มลงรายการ</button></div>`;
  dialog.showModal();
};
window.closeItem=()=>document.querySelector('#item-dialog').close();
window.confirmItem=id=>{
  const item=menu.find(m=>m.id===id&&m.available),error=document.querySelector('#detail-error');
  const raw=document.querySelector('#detail-qty').value,quantity=Number(raw);
  if(!item){error.textContent='เมนูนี้ไม่พร้อมขายแล้ว';return}
  if(!/^\d+$/.test(raw)||!Number.isInteger(quantity)||quantity<1||quantity+(cart[id]||0)>99){error.textContent='จำนวนรวมของเมนูนี้ต้องอยู่ระหว่าง 1 ถึง 99 จาน';return}
  const spice=document.querySelector('#detail-spice').value,taste=document.querySelector('#detail-taste').value;
  const previous=itemOptions[id]||{};
  if(cart[id]&&((previous.spice||'')!==spice||(previous.taste||'')!==taste)){error.textContent='เมนูเดียวกันใช้รายละเอียดร่วมกัน กรุณาแก้รสชาติในรายการเดิมก่อนเพิ่ม';return}
  itemOptions[id]={spice,taste};window.closeItem();window.change(id,quantity);
};
window.setOption=(id,key,value)=>{if(submittingOrder){msg('กำลังส่งออเดอร์ กรุณารอสักครู่',true);customer();return}if(!['spice','taste'].includes(key))return;itemOptions[id]??={};itemOptions[id][key]=value};
let requestingPayment=false;
window.requestPayment=()=>run(async()=>{if(!tableNo)throw Error('กรุณาสแกน QR ประจำโต๊ะ');if(requestingPayment)return;requestingPayment=true;try{const result=await api('request-payment',{table:tableNo});if(result==='no_unpaid_orders')throw Error('ยังไม่พบออเดอร์ที่ต้องชำระสำหรับโต๊ะนี้');msg('เรียกพนักงานเก็บเงินแล้ว กรุณารอสักครู่',true)}finally{requestingPayment=false}});
window.resolvePaymentRequest=id=>run(async()=>{await api('resolve-payment-request',{id});await refresh();msg('ปิดคำขอเรียกเก็บเงินแล้ว')});
let submittingOrder=false,pendingOrder=null;
window.submitOrder=()=>run(async()=>{if(submittingOrder)return;submittingOrder=true;const button=document.querySelector('#submit-order');if(button){button.disabled=true;button.textContent='กำลังส่งออเดอร์...'}try{if(!tableNo)throw Error('กรุณาสแกน QR ประจำโต๊ะ');const items=Object.entries(cart).filter(([,v])=>v).map(([id,qty])=>({id:Number(id),qty}));if(!items.length)throw Error('กรุณาเพิ่มอาหารก่อนสั่ง');preserveForm();const name=customerName.trim();if(!name)throw Error('กรุณากรอกชื่อผู้สั่ง');if(name.length>80)throw Error('ชื่อผู้สั่งต้องไม่เกิน 80 ตัวอักษร');const details=menu.filter(m=>cart[m.id]&&(itemOptions[m.id]?.spice||itemOptions[m.id]?.taste)).map(m=>`${m.name} × ${cart[m.id]}: ${[itemOptions[m.id].spice,itemOptions[m.id].taste].filter(Boolean).join(', ')}`);const note=details.join('\n');if(note.length>300)throw Error('รายละเอียดอาหารรวมกันต้องไม่เกิน 300 ตัวอักษร');const b={table:tableNo,customer:name,note,items};const fingerprint=JSON.stringify(b);if(!pendingOrder||pendingOrder.fingerprint!==fingerprint){if(!globalThis.crypto?.randomUUID)throw Error('เบราว์เซอร์ไม่รองรับการส่งออเดอร์อย่างปลอดภัย');pendingOrder={fingerprint,id:globalThis.crypto.randomUUID()}}const result=await api('order',{...b,requestId:pendingOrder.id});pendingOrder=null;cart={};itemOptions={};msg('ส่งออเดอร์ #'+result.id+' ให้ครัวแล้ว');customer()}finally{submittingOrder=false;const current=document.querySelector('#submit-order');if(current){current.disabled=!tableNo;current.textContent='ยืนยันส่งออเดอร์'}}});
function setup(){app.innerHTML=`<section id="staff-view" class="panel"><h2>ตั้งค่าร้านครั้งแรก</h2><p>ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษรสำหรับแต่ละหน้าที่</p><label>รหัสผ่านแม่ครัว<input type="password" id="k"></label><label>รหัสผ่านแคชเชียร์<input type="password" id="c"></label><button onclick="doSetup()">บันทึกรหัสผ่าน</button></section>`}
window.doSetup=()=>run(async()=>{await api('setup',{kitchen:document.querySelector('#k').value,cashier:document.querySelector('#c').value});msg('ตั้งค่าเรียบร้อย กรุณาเข้าสู่ระบบ');await refresh()});
function login(){app.innerHTML=`<section id="staff-view" class="panel"><h2>เข้าสู่ระบบพนักงาน</h2><label>หน้าที่<select id="role"><option value="kitchen">แม่ครัว</option><option value="cashier">แคชเชียร์</option></select></label><label>รหัสผ่าน<input type="password" id="password"></label><button onclick="doLogin()">เข้าสู่ระบบ</button> <button onclick="view='customer';render()">กลับไปหน้าเมนู</button></section>`}
window.doLogin=()=>run(async()=>{await api('login',{role:document.querySelector('#role').value,password:document.querySelector('#password').value});await refresh()});
function orderMarkup(history=false){const kitchen=info.role==='kitchen';return orders.filter(o=>kitchen?o.status!=='ready':history?o.paid:!o.paid).map(o=>`<div class="order"><div class="row"><strong>ออเดอร์ #${o.id} · โต๊ะ ${esc(o.table_no)}</strong><span class="badge">${{new:'รอทำ',cooking:'กำลังทำ',ready:'พร้อมเสิร์ฟ'}[o.status]}</span></div><p>${o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join('<br>')}</p>${o.note?`<p class="order-note">รายละเอียด: ${esc(o.note)}</p>`:''}${!kitchen?`<p>ลูกค้า: ${esc(o.customer||'ไม่ระบุ')} · รวม ฿${o.items.reduce((a,i)=>a+i.price*i.qty,0)} · ${o.paid?'ชำระแล้ว':'ยังไม่ชำระ'}</p>`:''}<p class="muted small">${new Date(o.created_at).toLocaleString('th-TH')}</p>${kitchen?`<button onclick="setStatus(${o.id},'${o.status==='new'?'cooking':'ready'}')">${o.status==='new'?'เริ่มทำ':'พร้อมเสิร์ฟ'}</button>`:(!o.paid?`<button onclick="pay(${o.id})">บันทึกว่าชำระแล้ว</button>${window.SUN_CONFIG?` <button onclick="attachSlip(${o.id})">ถ่ายรูปสลิปและยืนยัน</button>`:''}`:(window.SUN_CONFIG?`<button onclick="showSlip(${o.id})">ดูสลิป</button><div id="slip-${o.id}"></div>`:''))}</div>`).join('')||'<p class="muted">ยังไม่มีรายการ</p>'}
function renderOrders(){const el=document.querySelector('#orders-list');if(el)el.innerHTML=orderMarkup();const history=document.querySelector('#order-history');if(history)history.innerHTML=orderMarkup(true)}
function renderPaymentRequests(){const el=document.querySelector('#payment-requests');if(el)el.innerHTML=paymentRequests.map(r=>`<div class="order"><strong>โต๊ะ ${esc(r.table_no)} เรียกเก็บเงิน</strong><p class="muted small">${new Date(r.created_at).toLocaleString('th-TH')}</p><button onclick="resolvePaymentRequest(${r.id})">รับทราบและปิดคำขอ</button></div>`).join('')||'<p class="muted">ยังไม่มีคำขอเก็บเงิน</p>'}
function renderMenuAdmin(){const el=document.querySelector('#menu-admin');if(el)el.innerHTML=menu.map(m=>`<div class="order row"><span>${esc(m.name)} · ฿${m.price}</span><button onclick="toggleMenu(${m.id})">${m.available?'ปิดขาย':'เปิดขาย'}</button></div>`).join('')}
function dashboard(){const kitchen=info.role==='kitchen';app.innerHTML=`<div id="staff-view"><div class="tabs"><button class="active">${kitchen?'แม่ครัว':'แคชเชียร์'}</button><span class="muted small">อัปเดตอัตโนมัติ</span><button onclick="logout()">ออกจากระบบ</button></div><div class="layout"><section class="panel"><h2>${kitchen?'คิวอาหาร':'รายการสั่งซื้อ'}</h2><div id="orders-list"></div>${kitchen?'':`<details class="order-history"><summary>ประวัติรายการที่ชำระแล้ว</summary><p class="muted small">แสดงรายการล่าสุดไม่เกิน 500 ออเดอร์ รวมรายการที่ยังไม่ชำระ</p><div id="order-history"></div></details>`}</section>${kitchen?'':`<aside class="stack"><section class="panel"><h2>เรียกเก็บเงิน</h2><p class="muted small">ปิดคำขอหลังรับทราบ การชำระเงินต้องบันทึกในออเดอร์แยกต่างหาก</p><div id="payment-requests"></div></section><section class="panel"><h2>QR ประจำโต๊ะ</h2><p class="muted small">เปิดระบบด้วย IP ของเครื่องร้าน ก่อนสร้าง QR เพื่อให้โทรศัพท์สแกนได้</p><input id="qrTable" placeholder="หมายเลขโต๊ะ"><button onclick="makeQR()">สร้าง QR</button><div id="qr"></div></section><section class="panel"><h2>จัดการเมนู</h2><input id="newName" placeholder="ชื่ออาหาร"><input id="newPrice" type="number" min="0" placeholder="ราคา (บาท)"><button onclick="addMenu()">เพิ่มเมนู</button><div id="menu-admin"></div></section></aside>`}</div></div>`;renderOrders();renderMenuAdmin();renderPaymentRequests()}
window.setStatus=(id,status)=>run(async()=>{await api('status',{id,status});await refresh()});window.pay=id=>run(async()=>{await api('paid',{id});await refresh()});window.toggleMenu=id=>run(async()=>{await api('menu',{id});await refresh()});window.addMenu=()=>run(async()=>{const name=document.querySelector('#newName').value,raw=document.querySelector('#newPrice').value;if(!raw)throw Error('กรุณาระบุราคา');await api('menu',{name,price:Number(raw)});document.querySelector('#newName').value='';document.querySelector('#newPrice').value='';await refresh()});window.logout=()=>run(async()=>{await api('logout',{});info=null;await refresh()});window.makeQR=()=>run(async()=>{const table=document.querySelector('#qrTable').value;if(!table)throw Error('กรุณาระบุหมายเลขโต๊ะ');const v=await api('qr?table='+encodeURIComponent(table));document.querySelector('#qr').innerHTML=`<img class="qr" src="${v.data}" alt="QR สำหรับโต๊ะ ${esc(table)}"><p>โต๊ะ ${esc(table)} · พิมพ์หรือบันทึกภาพนี้เพื่อนำไปติดที่โต๊ะ</p>`});
// Staff must check the actual transfer before confirming payment.
window.attachSlip=id=>{
  const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('capture','environment');
  input.onchange=()=>run(async()=>{
    const file=input.files?.[0];if(!file)return;
    if(!file.type.startsWith('image/'))throw Error('กรุณาเลือกรูปภาพสลิป');
    const image=await createImageBitmap(file);
    try {
      const scale=Math.min(1,1600/Math.max(image.width,image.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      let url;for(const quality of [0.8,0.6,0.4]){url=canvas.toDataURL('image/jpeg',quality);if(url.length<=1398127)break;}
      if(url.length>1398127)throw Error('รูปภาพมีขนาดใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง');
      await api('paid-with-slip',{id,image:url.slice('data:image/jpeg;base64,'.length)});
      msg('บันทึกการชำระและรูปสลิปแล้ว');await refresh();
    } finally {image.close()}
  });input.click();
};
window.showSlip=id=>run(async()=>{
  const image=await api('payment-slip',{id});if(!image)throw Error('ออเดอร์นี้ไม่มีรูปสลิป');
  const target=document.querySelector('#slip-'+id);if(!target)return;
  const img=document.createElement('img');img.src='data:image/jpeg;base64,'+image.replace(/\s/g,'');img.alt='สลิปการชำระเงิน';img.style.maxWidth='100%';target.replaceChildren(img);
});
let liveTimer;function refreshSoon(){clearTimeout(liveTimer);liveTimer=setTimeout(()=>refresh().catch(()=>{}),500)}
window.sunLive?.start(refreshSoon);refresh().catch(e=>msg(e.message));setInterval(()=>{if(document.visibilityState==='visible')refresh().catch(()=>{})},15000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshSoon()});
