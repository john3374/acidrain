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
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Browsers ignore HSTS over plain HTTP, so this is harmless in development.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  // Not a full script policy (Next.js inline scripts and the OAuth redirects would need nonces and care); this
  // blocks framing, plugins and <base> hijacking.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
];

const nextConfig = {
  ...(websocketUrl ? { env: { SOCKET_CLIENT_URL: websocketUrl } } : {}),
  poweredByHeader: false,
  headers: () => [
    { source: '/:path*', headers: SECURITY_HEADERS },
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
