// Public browser client. The database enforces authorization independently of this code.
let accessToken = sessionStorage.getItem('sunAccessToken') || '';
let staffRole = null;
const config = window.SUN_CONFIG;
async function request(path, data, auth = true) {
  if (!config.publishableKey) throw Error('ยังไม่ได้ตั้งค่า Supabase publishable key');
  const headers = {apikey: config.publishableKey, 'Content-Type':'application/json'};
  if (auth && accessToken) headers.Authorization = 'Bearer ' + accessToken;
  const response = await fetch(config.url + path, {method: data === undefined ? 'GET' : 'POST', headers, ...(data === undefined ? {} : {body: JSON.stringify(data)})});
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Error(response.status === 401 ? 'เซสชันหมดอายุหรือข้อมูลเข้าสู่ระบบไม่ถูกต้อง' : (result?.message || 'ไม่สามารถเชื่อมต่อระบบได้'));
  return result;
}
const rpc = (name, body = {}) => request('/rest/v1/rpc/' + name, body);
async function api(path, data) {
  if (path === 'info') {
    if (accessToken) { try { staffRole = await rpc('my_role'); } catch { accessToken=''; staffRole=null; sessionStorage.removeItem('sunAccessToken'); } }
    return {setup:false, role:staffRole};
  }
  if (path === 'menu' && data === undefined) return staffRole === 'cashier' ? rpc('staff_menu') : request('/rest/v1/menu?select=*&order=id');
  if (path === 'login') {
    const session = await request('/auth/v1/token?grant_type=password',{email:data.email,password:data.password},false);
    accessToken = session.access_token; sessionStorage.setItem('sunAccessToken', accessToken);
    staffRole = await rpc('my_role');
    if (!staffRole) { accessToken=''; sessionStorage.removeItem('sunAccessToken'); throw Error('บัญชีนี้ยังไม่ได้รับสิทธิ์พนักงาน'); }
    return {ok:true};
  }
  if (path === 'logout') { try { await request('/auth/v1/logout',{}); } finally { accessToken=''; staffRole=null; sessionStorage.removeItem('sunAccessToken'); } return {ok:true}; }
  if (path === 'order') {const id=await rpc('place_order',{p_table:data.table,p_customer:data.customer,p_note:data.note,p_items:data.items});window.sunLive?.notify();return {id};}
  if (path === 'orders') return rpc('staff_orders');
  if (path === 'status') {const result=await rpc('update_order_status',{p_id:data.id,p_status:data.status});window.sunLive?.notify();return result;}
  if (path === 'paid') {const result=await rpc('mark_order_paid',{p_id:data.id});window.sunLive?.notify();return result;}
  if (path === 'request-payment') {const result=await rpc('request_payment',{p_table:data.table});window.sunLive?.notify();return result;}
  if (path === 'payment-requests') return rpc('staff_payment_requests');
  if (path === 'resolve-payment-request') {const result=await rpc('resolve_payment_request',{p_id:data.id});window.sunLive?.notify();return result;}
  if (path === 'menu' && data) {const result=await rpc('manage_menu',{p_id:data.id||null,p_name:data.name||null,p_price:data.price??null});window.sunLive?.notify();return result;}
  if (path.startsWith('qr?')) {const r=await fetch('/.netlify/functions/qr?'+path.slice(3));const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
  throw Error('ไม่พบคำสั่ง');
}
