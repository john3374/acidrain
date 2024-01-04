import { Score } from '@/schema';
import '@/db';

const GET = async () => {
  const scores = await Score.aggregate([{ $match: { player: { $ne: null } } }, { $sort: { score: -1 } }, { $limit: 10 }]);
  const result = (await Score.populate(scores, 'player')).map(score => ({
    nickname: score.player?.nickname,
    score: score.score,
    created: score.created,
  }));
  return Response.json(result);
};

export { GET };
