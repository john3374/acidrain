const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || process.env.WEBSOCKET_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(websocketUrl ? { env: { NEXT_PUBLIC_WEBSOCKET_URL: websocketUrl } } : {}),
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
