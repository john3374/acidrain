import NextAuth from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import { connectDB } from '@/db';
import { Achievement, Player, Score } from '@/schema';
import { validateNickname } from '@/lib/nickname';

// A Player is found by email, so only an address the provider has confirmed may sign in to one.
const githubEmailVerified = async (email, accessToken) => {
  if (!accessToken) return false;
  try {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return false;
    const emails = await res.json();
    return Array.isArray(emails) && emails.some(e => e?.verified === true && e.email?.toLowerCase() === email.toLowerCase());
  } catch (err) {
    console.log('failed to check GitHub email', err);
    return false;
  }
};

const hasVerifiedEmail = async (user, account, profile) => {
  if (typeof user?.email !== 'string' || !user.email.includes('@')) return false;
  switch (account?.provider) {
    case 'google':
      return profile?.email_verified === true;
    case 'discord':
      return profile?.verified === true;
    case 'github':
      return githubEmailVerified(user.email, account.access_token);
    default:
      return false;
  }
};

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
    async signIn({ user, account, profile }) {
      if (!(await hasVerifiedEmail(user, account, profile))) return false;
      await connectDB();
      const updatedUser = await Player.findOneAndUpdate({ email: user.email }, {}, { upsert: true, new: true });
      user.nickname = updatedUser.nickname;
      user.id = updatedUser._id.toString();
      return user;
    },
    async session({ session, token: { nickname, image, id } }) {
      // console.log('session', session);
      // console.log('token', token);
      session.user = { nickname, image, id };
      return session;
    },
    async jwt(params) {
      // console.log('jwt', params);
      Object.assign(params.token, params.user);
      if (params.trigger === 'update') {
        if (params.session.delete === 1) {
          try {
            await connectDB();
            const deleted = await Player.findOneAndDelete({ email: params.token.email });
            Score.deleteMany({ player: deleted._id }).catch(err => console.log('failed to delete scores', err));
            Achievement.deleteMany({ player: deleted._id }).catch(err => console.log('failed to delete achievements', err));
            return {};
          } catch (e) {
            console.log(e);
          }
        } else if (params.session.nickname) {
          const parsed = validateNickname(params.session.nickname);
          if (!parsed.valid) return { ...params.token };

          // The session shows the new nickname only once the database has taken it (it is unique).
          try {
            await connectDB();
            await Player.updateOne({ email: params.token.email }, { $set: { nickname: parsed.value } });
            params.token.nickname = parsed.value;
          } catch (err) {
            console.log('failed to change nickname', err);
          }
        }
      }
      return { ...params.token };
    },
  },
});

export { handler as GET, handler as POST };
