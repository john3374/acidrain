require('dotenv').config();
import { io } from 'socket.io-client';

export const socket = io('https://acidrain.akfn.net');
export const clientId = Math.random().toString(36).slice(2);
socket.on('connect', () => {
  socket.emit('init', clientId);
});
