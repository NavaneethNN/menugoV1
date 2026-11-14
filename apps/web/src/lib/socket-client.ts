import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl } from './api';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const API_URL =
    getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001');
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: token ? { token } : {}
    });
  } else if (token) {
    socket.auth = { ...(socket.auth || {}), token };
    if (!socket.connected) {
      socket.connect();
    }
  }
  return socket;
}
