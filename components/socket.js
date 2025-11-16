import dotenv from 'dotenv';
dotenv.config();
import { io } from 'socket.io-client';

export const socket = io('http://localhost:4000');
export const clientId = Math.random().toString(36).slice(2);
