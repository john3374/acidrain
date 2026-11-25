import NextAuth from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import { callbacks } from '@/lib/authCallbacks';

const handler = NextAuth({
  // logger: {
  //   error(code, metadata) {
  //     console.log('err', code, metadata);
  //   },
  //   warn(code, metadata) {
  //     console.log('warn', code, metadata);
  //   },
  //   debug(code, metadata) {
  //     console.log('debug', code, metadata);
  //   },
  // },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks,
});

export { handler as GET, handler as POST };
