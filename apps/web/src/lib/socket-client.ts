import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
