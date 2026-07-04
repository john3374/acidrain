import { Score } from '@/schema';
import rateLimit from '@/middlewares/rateLimit';
import { connectDB } from '@/db';

export const dynamic = 'force-dynamic';

const GET = async req => {
  try {
    const limit = rateLimit(req);
    if (limit.limited) {
      return new Response('Too many requests', { status: 429, headers: limit.headers });
    }

    await connectDB();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const scores = await Score.aggregate([{ $match: { created: { $gte: startOfDay } } }, { $sort: { score: -1 } }, { $limit: 10 }]);
    const result = (await Score.populate(scores, 'player')).map(score => ({
      nickname: score.player?.nickname || '익명',
      score: score.score,
      created: score.created,
    }));
    return Response.json(result, { headers: limit.headers });
  } catch (e) {
    console.log(e);
    return new Response('Unknown error', { status: 500 });
  }
};

export { GET };
