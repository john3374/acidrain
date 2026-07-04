import { io } from 'socket.io-client';

const LOCAL_SOCKET_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

const configuredSocketUrl = process.env.SOCKET_CLIENT_URL || '';

const isLocalHostname = hostname => LOCAL_SOCKET_HOSTS.has(hostname);

const isLocalUrl = value => {
  try {
    return isLocalHostname(new URL(value).hostname);
  } catch {
    return false;
  }
};

const isLocalPage = () => typeof window !== 'undefined' && isLocalHostname(window.location.hostname);

const getSocketUrl = () => {
  if (configuredSocketUrl && (isLocalPage() || !isLocalUrl(configuredSocketUrl))) {
    return configuredSocketUrl;
  }

  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://acidrain.akfn.net';
};

export const socket = io(getSocketUrl());
export const clientId = Math.random().toString(36).slice(2);
