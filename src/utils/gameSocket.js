import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from './api';

/** Main game namespace; auth token is set before connect (see connectGameSocket). */
export const socket = io(SOCKET_BASE_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
});

export function connectGameSocket() {
  const token = localStorage.getItem('token');
  if (!token) {
    if (socket.connected) socket.disconnect();
    return;
  }
  socket.auth = { token };
  if (!socket.connected) socket.connect();
}

export function disconnectGameSocket() {
  socket.disconnect();
}
