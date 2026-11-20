const fs = require('node:fs');
fs.mkdirSync('cloud', {recursive:true});
for (const name of ['style.css','supabase-api.js','supabase-config.js']) fs.copyFileSync('public/'+name,'cloud/'+name);
if (process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) {
  const url = new URL(process.env.SUPABASE_URL);
  if (url.protocol !== 'https:') throw Error('SUPABASE_URL must use HTTPS');
  fs.writeFileSync('cloud/supabase-config.js', `window.SUN_CONFIG = ${JSON.stringify({url:url.origin,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY})};\n`);
}
let html=fs.readFileSync('public/index.html','utf8');
html=html.replace('<script src="/app.js"></script>','<script src="/supabase-config.js"></script><script src="/supabase-api.js"></script><script src="/app.js"></script>');
fs.writeFileSync('cloud/index.html',html);
let js=fs.readFileSync('public/app.js','utf8');
js=js.replace(/async function api\(path,data\)\{.*?\}\n/, '');
js=js.replace(/<label>หน้าที่<select id="role">.*?<\/select><\/label>/, '<label>อีเมลพนักงาน<input type="email" id="email" autocomplete="username"></label>');
js=js.replace("role:document.querySelector('#role').value", "email:document.querySelector('#email').value");
js=js.replace("[info,menu]=await Promise.all([api('info'),api('menu')]);", "info=await api('info');menu=await api('menu');");
js=js.replace('เปิดระบบด้วย IP ของเครื่องร้าน ก่อนสร้าง QR เพื่อให้โทรศัพท์สแกนได้','QR นี้นำไปพิมพ์และติดไว้ที่โต๊ะได้');
fs.writeFileSync('cloud/app.js',js);
if(js.includes('async function api(path,data)')||!js.includes('id="email"')||!js.includes("querySelector('#email')")) throw Error('Cloud UI transformation failed; inspect source');
