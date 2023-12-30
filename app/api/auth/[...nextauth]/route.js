import NextAuth from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import '@/db';
import { Player } from '@/schema';

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
  callbacks: {
    async signIn({ user, account }) {
      const updatedUser = await Player.findOneAndUpdate({ email: user.email }, {}, { upsert: true, new: true });
      user.nickname = updatedUser.nickname;
      user.id = updatedUser._id.toString();
      return user;
    },
    async session({ session, token }) {
      // console.log('session', session);
      // console.log('token', token);
      session.user.nickname = token.nickname;
      session.user.image = token.image;
      session.user.id = token.id;
      return session;
    },
    async jwt(params) {
      // console.log('jwt', params);
      Object.assign(params.token, params.user);
      if (params.trigger === 'update' && params.session.nickname) {
        params.token.nickname = params.session.nickname;
        Player.findOneAndUpdate({ email: params.token.email }, { $set: { nickname: params.session.nickname } }).catch(err =>
          console.log('failed to change nickname', err)
        );
      }
      return { ...params.token };
    },
  },
});

export { handler as GET, handler as POST };
