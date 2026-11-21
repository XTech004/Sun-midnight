const QRCode = require('qrcode');
exports.handler = async event => {
  try {
    const table = String(event.queryStringParameters?.table || '').trim();
    if (!table || table.length > 20) return {statusCode:400, body:JSON.stringify({error:'หมายเลขโต๊ะไม่ถูกต้อง'})};
    // URL is configured at deployment, not derived from a user-controlled Host header.
    const base = process.env.URL;
    if (!base || !/^https:\/\//.test(base)) return {statusCode:503,body:JSON.stringify({error:'ยังไม่ได้ตั้งค่า URL เว็บไซต์'})};
    const production = new URL(base);
    let origin=production.origin;
    const requested=event.queryStringParameters?.origin;
    if(requested){
      const candidate=new URL(requested);
      const previewPrefix='--'+production.hostname;
      const isPreview=production.hostname.endsWith('.netlify.app')&&candidate.hostname.endsWith(previewPrefix)&&/^deploy-preview-\d+$/.test(candidate.hostname.slice(0,-previewPrefix.length));
      if(candidate.protocol!=='https:'||(candidate.origin!==production.origin&&!isPreview)||candidate.port) return {statusCode:400,body:JSON.stringify({error:'ที่อยู่เว็บไซต์ไม่ถูกต้อง'})};
      origin=candidate.origin;
    }
    const url = new URL('/', origin); url.searchParams.set('table',table);
    return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({data:await QRCode.toDataURL(url.toString(),{width:320,margin:2})})};
  } catch { return {statusCode:500,body:JSON.stringify({error:'สร้าง QR ไม่สำเร็จ'})}; }
};
