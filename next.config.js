const LOCAL_SOCKET_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

const isLocalSocketUrl = value => {
  try {
    return LOCAL_SOCKET_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
};

const configuredWebsocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || process.env.WEBSOCKET_URL;
const websocketUrl =
  configuredWebsocketUrl && !(process.env.NODE_ENV === 'production' && isLocalSocketUrl(configuredWebsocketUrl))
    ? configuredWebsocketUrl
    : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(websocketUrl ? { env: { SOCKET_CLIENT_URL: websocketUrl } } : {}),
  headers: () => [
    {
      source: '/api/score/:path*',
      headers: [{ key: 'Cache-Control', value: 'no-store' }],
    },
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
};

module.exports = nextConfig;
