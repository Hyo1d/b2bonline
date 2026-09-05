import { randomBytes, randomInt } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { WebSocket } from 'ws';
import type { AuthorityMode, Slot } from '../../../shared/protocol';
export class RoomError extends Error { constructor(public status:number,message:string) {super(message);} }
export type Peer = {peerId:string;token:string;name:string;slot:Slot;socket?:WebSocket;lastSeen:number;sequence:number};
export type Room = {roomId:string;peers:Map<string,Peer>;mode:AuthorityMode;authority:string;leaseUntil:number;version:number;bpm:number;lastSeen:number};
export interface RoomStore {get(id:string):Room|undefined;set(id:string,room:Room):unknown;delete(id:string):unknown;values():IterableIterator<Room>;size:number}
export class RoomManager {
  constructor(public store:RoomStore = new Map(),public now=()=>performance.now(),public graceMs=60000) {}
  private peer(name:string,slot:Slot):Peer {return {peerId:randomBytes(12).toString('hex'),token:randomBytes(32).toString('hex'),name,slot,lastSeen:this.now(),sequence:-1};}
  create(name:string) {
    if(this.store.size>=10000) throw new RoomError(503,'Servidor completo');
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let id='';
    do {id=Array.from({length:8},()=>alphabet[randomInt(alphabet.length)]).join('');} while(this.store.get(id));
    const peer=this.peer(name,'DJ_A');
    const room:Room={roomId:id,peers:new Map([[peer.peerId,peer]]),mode:'AUTO',authority:peer.peerId,leaseUntil:0,version:0,bpm:120,lastSeen:this.now()};
    this.store.set(id,room);return {room,peer};
  }
  join(id:string,name:string) {
    this.sweep(); const room=this.get(id);
    if(room.peers.size>=2) throw new RoomError(409,'La room ya tiene dos DJs');
    const peer=this.peer(name,[...room.peers.values()].some(p=>p.slot==='DJ_A')?'DJ_B':'DJ_A'); room.peers.set(peer.peerId,peer);room.lastSeen=this.now();return {room,peer};
  }
  get(id:string) {const room=this.store.get(id);if(!room) throw new RoomError(404,'Room inexistente o vencida');return room;}
  authenticate(id:string,peerId:string,token:string) {
    const room=this.get(id),peer=room.peers.get(peerId);
    if(!peer || peer.token!==token || (!peer.socket && this.now()-peer.lastSeen>this.graceMs)) throw new RoomError(401,'La reserva venció; creá o uníte nuevamente');
    return {room,peer};
  }
  publicState(room:Room) {return {type:'room.state',roomId:room.roomId,peers:[...room.peers.values()].map(p=>({peerId:p.peerId,name:p.name,slot:p.slot,connected:p.socket?.readyState===1})),authority:this.authority(room)};}
  authority(room:Room) {return {mode:room.mode,peerId:room.authority,version:room.version,bpm:room.bpm};}
  tempo(room:Room,peer:Peer,bpm:number,sequence:number) {
    if(sequence<=peer.sequence) return false;peer.sequence=sequence;
    if(room.mode!=='AUTO' && peer.slot!==room.mode) return false;
    if(room.mode==='AUTO' && room.authority!==peer.peerId && this.now()<room.leaseUntil) return false;
    if(Math.abs(bpm-room.bpm)<=0.1) return false;
    room.authority=peer.peerId;room.bpm=bpm;room.version++;room.leaseUntil=this.now()+3000;return true;
  }
  mode(room:Room,peer:Peer,mode:AuthorityMode) {
    if(peer.slot!=='DJ_A') throw new RoomError(403,'Sólo el creador cambia el modo de tempo');
    const owner=[...room.peers.values()].find(p=>p.slot===mode);
    if(mode!=='AUTO' && !owner) throw new RoomError(409,'Ese DJ todavía no está en la room');
    room.mode=mode;if(owner) room.authority=owner.peerId;room.version++;room.leaseUntil=0;
  }
  remove(room:Room,peer:Peer) {
    room.peers.delete(peer.peerId);
    if(!room.peers.size) {this.store.delete(room.roomId);return;}
    if(room.authority===peer.peerId) {room.authority=room.peers.keys().next().value!;room.mode='AUTO';room.version++;room.leaseUntil=0;}
  }
  sweep() {
    for(const room of this.store.values()) {
      for(const peer of room.peers.values()) if(!peer.socket && this.now()-peer.lastSeen>this.graceMs) this.remove(room,peer);
      if(this.now()-room.lastSeen>12*3600000) {for(const p of room.peers.values()) p.socket?.close(4000,'Room vencida');this.store.delete(room.roomId);}
    }
  }
}
