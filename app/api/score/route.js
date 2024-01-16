import { Score } from '@/schema';
import rateLimit from '@/middlewares/rateLimit';
import '@/db';

const GET = async () => {
  try {
    if (rateLimit(req)) {
      return new Response('Too many requests', {
        status: 429,
        // headers: {
        //   'X-RateLimit-Limit': limit.toString(),
        //   'X-RateLimit-Remaining': 0,
        //   'X-RateLimit-Reset': reset.toString(),
        // },
      });
    }

    const scores = await Score.aggregate([{ $match: { player: { $ne: null } } }, { $sort: { score: -1 } }, { $limit: 10 }]);
    const result = (await Score.populate(scores, 'player')).map(score => ({
      nickname: score.player?.nickname,
      score: score.score,
      created: score.created,
    }));
    return Response.json(result);
  } catch (e) {
    console.log(e);
    return new Response('Unknown error', { status: 500 });
  }
};

export { GET };
