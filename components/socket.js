import { io } from 'socket.io-client';

const socketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || 'https://acidrain.akfn.net';

export const socket = io(socketUrl);
export const clientId = Math.random().toString(36).slice(2);
