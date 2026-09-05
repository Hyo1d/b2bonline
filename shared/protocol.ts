export const VERSION = 1;
export const MAX_PAYLOAD = 65536;
export const ROOM_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
export type Slot = 'DJ_A' | 'DJ_B';
export type AuthorityMode = 'AUTO' | Slot;
export type Member = {peerId:string; name:string; slot:Slot; connected:boolean};
export type Ticket = {roomId:string; peerId:string; token:string; slot:Slot; iceServers:RTCIceServer[]};
export function finite(value:unknown, min:number, max:number): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
export function validName(value:unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= 40 && !/[\x00-\x1f]/.test(value); }
export function validSignal(message:any):boolean {
  if (!message || typeof message !== 'object') return false;
  if (message.type === 'webrtc.offer' || message.type === 'webrtc.answer') return typeof message.sdp === 'string' && message.sdp.length < 60000 && message.sdp.startsWith('v=0');
  if (message.type === 'webrtc.ice') return message.candidate && typeof message.candidate.candidate === 'string' && message.candidate.candidate.length < 2048 && (typeof message.candidate.sdpMid === 'string' || message.candidate.sdpMid === null) && (message.candidate.sdpMLineIndex === null || finite(message.candidate.sdpMLineIndex,0,16));
  return false;
}
