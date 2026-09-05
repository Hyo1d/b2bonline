import http from 'node:http';
import { createHmac } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager, RoomError, type Room, type Peer } from './rooms/RoomManager';
import { MAX_PAYLOAD, ROOM_PATTERN, validName, validSignal, finite } from '../../shared/protocol';
export function startServer(port=8787,host='127.0.0.1') {
  const manager=new RoomManager(); const limits=new Map<string,{count:number;reset:number}>();
  const send=(ws:WebSocket|undefined,data:unknown)=>{if(ws?.readyState===WebSocket.OPEN && ws.bufferedAmount<MAX_PAYLOAD*4) ws.send(JSON.stringify(data));};
  const broadcast=(room:Room,data:unknown)=>{for(const p of room.peers.values()) send(p.socket,data);};
  const iceServers=()=>{
    const result:any[]=[{urls:process.env.STUN_URL || 'stun:stun.l.google.com:19302'}];
    if(process.env.TURN_URL && process.env.TURN_SECRET) {const username=`${Math.floor(Date.now()/1000)+86400}:remote-b2b`;result.push({urls:process.env.TURN_URL.split(','),username,credential:createHmac('sha1',process.env.TURN_SECRET).update(username).digest('base64')});}return result;
  };
  const allowed=(ip:string)=>{const now=performance.now();let entry=limits.get(ip);if(!entry||now>entry.reset){entry={count:0,reset:now+60000};limits.set(ip,entry);}return ++entry.count<=60;};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    try {
      if(req.url==='/health' && req.method==='GET') {res.end(JSON.stringify({ok:true,version:1}));return;}
      if(!allowed(req.socket.remoteAddress||'')) throw new RoomError(429,'Demasiadas solicitudes; esperá un minuto');
      if(req.method!=='POST') throw new RoomError(404,'Ruta inexistente');
      let body='';for await(const chunk of req) {body+=chunk;if(body.length>2048) throw new RoomError(413,'Payload demasiado grande');}
      let data:any;try {data=JSON.parse(body);}catch{throw new RoomError(400,'JSON inválido');}
      if(!validName(data.name)) throw new RoomError(400,'Nombre inválido');
      const match=req.url?.match(/^\/rooms\/([A-HJ-NP-Z2-9]{8})\/join$/);
      const result=req.url==='/rooms'?manager.create(data.name.trim()):match?manager.join(match[1],data.name.trim()):null;
      if(!result) throw new RoomError(404,'Ruta inexistente');
      const {room,peer}=result;res.statusCode=201;res.end(JSON.stringify({roomId:room.roomId,peerId:peer.peerId,token:peer.token,slot:peer.slot,iceServers:iceServers()}));
    } catch(error) {res.statusCode=error instanceof RoomError?error.status:500;res.end(JSON.stringify({error:error instanceof RoomError?error.message:'Error interno'}));}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:MAX_PAYLOAD,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{if(req.url!=='/ws' || !allowed(req.socket.remoteAddress||'')){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
  wss.on('connection',ws=>{
    let room:Room|undefined,peer:Peer|undefined;let alive=true,count=0,windowStart=performance.now();
    const authTimer=setTimeout(()=>{if(!peer) ws.close(4001,'Autenticación requerida');},5000);
    ws.on('pong',()=>alive=true);
    const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},15000);
    ws.on('message',(raw,isBinary)=>{
      try {
        if(isBinary) throw new RoomError(400,'Sólo control JSON');
        if(performance.now()-windowStart>1000){windowStart=performance.now();count=0;}if(++count>100) throw new RoomError(429,'Rate limit');
        const m=JSON.parse(raw.toString());if(!m||typeof m!=='object') throw new RoomError(400,'Mensaje inválido');
        if(!peer) {
          if(m.type!=='room.join'||!ROOM_PATTERN.test(m.roomId)||typeof m.peerId!=='string'||typeof m.token!=='string') throw new RoomError(401,'Ticket inválido');
          ({room,peer}=manager.authenticate(m.roomId,m.peerId,m.token));
          const previous=peer.socket;peer.socket=ws;previous?.close(4002,'Sesión reemplazada');peer.lastSeen=performance.now();room.lastSeen=performance.now();clearTimeout(authTimer);
          broadcast(room,{type:'room.peer-connected',peerId:peer.peerId});broadcast(room,manager.publicState(room));return;
        }
        if(!room||peer.socket!==ws) return;room.lastSeen=performance.now();
        if(m.type==='room.leave') {manager.remove(room,peer);broadcast(room,manager.publicState(room));peer.socket=undefined;ws.close(1000);return;}
        if(m.type==='tempo.request') {
          if(!finite(m.bpm,20,300)||!Number.isSafeInteger(m.sequence)||m.sequence<0) throw new RoomError(400,'Tempo inválido');
          manager.tempo(room,peer,m.bpm,m.sequence);broadcast(room,{type:'room.authority',...manager.authority(room)});return;
        }
        if(m.type==='authority.set') {if(!['AUTO','DJ_A','DJ_B'].includes(m.mode)) throw new RoomError(400,'Modo inválido');manager.mode(room,peer,m.mode);broadcast(room,{type:'room.authority',...manager.authority(room)});return;}
        if(!validSignal(m)) throw new RoomError(400,'Señal inválida');
        const payload=m.type==='webrtc.ice'?{candidate:m.candidate}:{sdp:m.sdp};
        for(const other of room.peers.values()) if(other!==peer) send(other.socket,{type:m.type,...payload,from:peer.peerId});
      } catch(error) {send(ws,{type:'error',message:error instanceof Error?error.message:'Mensaje inválido'});if(!peer) ws.close(4001);}
    });
    ws.on('error',()=>{});
    ws.on('close',()=>{clearTimeout(authTimer);clearInterval(heartbeat);if(room&&peer&&peer.socket===ws){peer.socket=undefined;peer.lastSeen=performance.now();broadcast(room,{type:'room.peer-disconnected',peerId:peer.peerId});broadcast(room,manager.publicState(room));}});
  });
  const sweep=setInterval(()=>{manager.sweep();for(const [ip,l] of limits) if(performance.now()>l.reset) limits.delete(ip);},5000);
  server.listen(port,host);
  return {server,manager,close:async()=>{clearInterval(sweep);for(const ws of wss.clients) ws.terminate();await new Promise<void>(r=>wss.close(()=>r()));await new Promise<void>(r=>server.close(()=>r()));}};
}
