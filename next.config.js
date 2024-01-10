/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: () => [{ source: '/api/score', headers: [{ key: 'Cache-Control', value: 'no-store' }] }],
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
