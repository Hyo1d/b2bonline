export const defaults = {
  audio: { sampleRate: 48000, opusBitrate: 128000, frameMs: 10, jitterBufferMs: 80 },
  network: { reconnect: true, serverUrl: 'http://127.0.0.1:8787', iceServers: [{urls:'stun:stun.l.google.com:19302'}] as RTCIceServer[] },
  quality: { good: {rtt:50,jitter:10,loss:1}, ok:{rtt:100,jitter:30,loss:3} }
};
export type Config = typeof defaults;
