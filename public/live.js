// Broadcasts only a generic invalidation, never order or customer data.
// Database remains authoritative; periodic refresh covers dropped messages.
(() => {
  let socket,joined=false,ref=0,joinRef,heartbeat,retry,callback,lastSignal=0;
  const topic='realtime:sun-midnight-updates';
  function send(join,channel,event,payload){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify([join,String(++ref),channel,event,payload]))}
  function connect(){
    const config=window.SUN_CONFIG;if(!config?.url||!config.publishableKey||typeof WebSocket==='undefined')return;
    let url;try{url=new URL(config.url);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/realtime/v1/websocket';url.search=new URLSearchParams({apikey:config.publishableKey,vsn:'2.0.0'}).toString();socket=new WebSocket(url.toString())}catch{return}
    socket.onopen=()=>{joined=false;joinRef=String(ref+1);send(joinRef,topic,'phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[],private:false}});clearInterval(heartbeat);heartbeat=setInterval(()=>send(null,'phoenix','heartbeat',{}),20000)};
    socket.onmessage=e=>{let frame;try{frame=JSON.parse(e.data)}catch{return}if(!Array.isArray(frame)||frame[2]!==topic)return;const [,replyRef,,event,payload]=frame;if(event==='phx_reply'&&replyRef===joinRef){joined=payload?.status==='ok';if(!joined)socket.close()}else if(event==='broadcast'&&payload?.event==='changed'){const now=Date.now();if(now-lastSignal>=2000){lastSignal=now;callback?.()}}};
    socket.onclose=()=>{joined=false;clearInterval(heartbeat);clearTimeout(retry);retry=setTimeout(connect,10000)};
    socket.onerror=()=>socket.close();
  }
  window.sunLive={start(fn){callback=fn;connect()},notify(){if(joined)send(joinRef,topic,'broadcast',{type:'broadcast',event:'changed',payload:{}})}};
})();
