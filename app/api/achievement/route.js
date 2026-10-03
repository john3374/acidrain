import { getToken } from 'next-auth/jwt';

import { connectDB } from '@/db';
import { listEarned, listGamesPlayed } from '@/lib/achievements';
import rateLimit from '@/middlewares/rateLimit';

export const dynamic = 'force-dynamic';

// The signed-in Player's Achievements and Games played, for the profile popup. Guests have none to show.
const GET = async req => {
  try {
    const limit = rateLimit(req);
    if (limit.limited) {
      return new Response('Too many requests', { status: 429, headers: limit.headers });
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return new Response('Unauthorized', { status: 401, headers: limit.headers });

    await connectDB();
    const [gamesPlayed, earned] = await Promise.all([listGamesPlayed(token.id), listEarned(token.id)]);
    return Response.json(
      { gamesPlayed: gamesPlayed.length, achievements: earned.map(({ achievement, earned }) => ({ id: achievement, earned })) },
      { headers: limit.headers }
    );
  } catch (e) {
    console.log(e);
    return new Response('Unknown error', { status: 500 });
  }
};

export { GET };
