import {randomBytes} from 'node:crypto';
import {WebSocket,WebSocketServer} from 'ws';
import type {Room,Peer,RoomManager} from './rooms/RoomManager';
import {RoomError} from './rooms/RoomManager';
import {validSignal,MAX_PAYLOAD} from '../../shared/protocol';
export class Audience {
  sessions=new Map<string,{id:string;room:Room;owner:Peer;guests:Map<string,WebSocket>}>();
  wss=new WebSocketServer({noServer:true,maxPayload:MAX_PAYLOAD,perMessageDeflate:false});
  constructor(private manager:RoomManager,private send:(ws:WebSocket|undefined,m:any)=>void,private ice:()=>any[]){ }
  list(){return [...this.sessions.values()].filter(s=>s.owner.socket?.readyState===1).map(s=>({id:s.id,names:[...s.room.peers.values()].filter(p=>p.socket?.readyState===1).map(p=>p.name),listeners:s.guests.size,capacity:4}));}
  notify(room:Room){const s=this.sessions.get(room.roomId);for(const p of room.peers.values())this.send(p.socket,{type:'audience.state',publicId:s?.id||null,listeners:s?.guests.size||0});}
  stop(room:Room){const s=this.sessions.get(room.roomId);if(!s)return;this.sessions.delete(room.roomId);for(const ws of s.guests.values())ws.close(4000,'La transmisión terminó');this.send(s.owner.socket,{type:'audience.reset'});this.notify(room);}
  handle(room:Room,peer:Peer,m:any){
    if(!m.type?.startsWith('audience.'))return false;
    if(m.type==='audience.publish'){
      if(peer.slot!=='DJ_A'||typeof m.enabled!=='boolean')throw new RoomError(403,'Sólo el creador puede publicar');
      if(m.enabled&&!this.sessions.has(room.roomId))this.sessions.set(room.roomId,{id:randomBytes(16).toString('hex'),room,owner:peer,guests:new Map()});
      if(!m.enabled)this.stop(room);this.notify(room);return true;
    }
    const s=this.sessions.get(room.roomId);if(!s||s.owner!==peer)throw new RoomError(403,'Sin transmisión');
    if(!['audience.offer','audience.ice'].includes(m.type)||!validSignal({...m,type:m.type.replace('audience.','webrtc.')}))throw new RoomError(400,'Señal inválida');
    this.send(s.guests.get(m.to),{type:m.type,...(m.type==='audience.offer'?{sdp:m.sdp}:{candidate:m.candidate})});return true;
  }
  accept(id:string,ws:WebSocket){
    const s=[...this.sessions.values()].find(s=>s.id===id&&s.owner.socket?.readyState===1);
    if(!s||s.guests.size>=4){ws.close(4000,s?'Sesión completa (4 oyentes)':'Sesión finalizada');return;}
    const guest=randomBytes(12).toString('hex');s.guests.set(guest,ws);let alive=true,count=0,start=Date.now();
    const heartbeat=setInterval(()=>{if(!alive)ws.terminate();else{alive=false;ws.ping();}},15000);ws.on('pong',()=>alive=true);
    this.send(ws,{type:'audience.ready',iceServers:this.ice()});this.send(s.owner.socket,{type:'audience.join',guest});this.notify(s.room);
    ws.on('message',(raw,binary)=>{try{if(Date.now()-start>1000){start=Date.now();count=0;}if(binary||++count>100)throw Error();const m=JSON.parse(raw.toString());
      if(!['audience.answer','audience.ice'].includes(m.type)||!validSignal({...m,type:m.type.replace('audience.','webrtc.')}))throw Error();
      this.send(s.owner.socket,{type:m.type,guest,...(m.type==='audience.answer'?{sdp:m.sdp}:{candidate:m.candidate})});
    }catch{ws.close(4003,'Acceso sólo de escucha');}});
    ws.on('error',()=>{});ws.on('close',()=>{clearInterval(heartbeat);s.guests.delete(guest);this.send(s.owner.socket,{type:'audience.left',guest});this.notify(s.room);});
  }
  sweep(){for(const s of this.sessions.values())if(this.manager.store.get(s.room.roomId)!==s.room||s.owner.socket?.readyState!==1||!s.room.peers.has(s.owner.peerId))this.stop(s.room);}
  close(){for(const s of this.sessions.values())this.stop(s.room);for(const ws of this.wss.clients)ws.terminate();this.wss.close();}
}
