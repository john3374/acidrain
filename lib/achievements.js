import { achievementById, gamesPlayedAchievements, inGameAchievements, isGamePlayed } from '../game/achievements.js';
import { Achievement, Score } from '../schema/index.js';

const DUPLICATE_KEY = 11000;

// A Player's Games played, oldest first. Old Scores have no Hits, so the filter runs here rather than in the query.
export const listGamesPlayed = async playerId => {
  const scores = await Score.find({ player: playerId }, { score: 1, hits: 1, created: 1 }).sort({ created: 1, _id: 1 }).lean();
  return scores.filter(isGamePlayed);
};

export const listEarned = playerId => Achievement.find({ player: playerId }, { achievement: 1, earned: 1 }).lean();

/**
 * Award a Player the Achievements their just-saved Score earns, plus any Games-played step their older Scores
 * already reached but never got (there is no separate backfill). Returns the ids newly awarded, in display order.
 * `game` carries the finished Game's numbers: startingLevel, levelReached, flawlessClear, hits.
 */
export const awardAchievements = async ({ playerId, score, game }) => {
  const [gamesPlayed, earned] = await Promise.all([listGamesPlayed(playerId), listEarned(playerId)]);
  const owned = new Set(earned.map(record => record.achievement));
  const records = [];

  for (const id of inGameAchievements(game)) {
    if (!owned.has(id)) records.push({ player: playerId, achievement: id, score: score._id, earned: score.created });
  }
  // A ladder step is dated by the Game played that crossed its threshold, which may be an old Score.
  for (const id of gamesPlayedAchievements(gamesPlayed.length)) {
    if (owned.has(id)) continue;
    const crossing = gamesPlayed[achievementById(id).gamesPlayed - 1];
    records.push({ player: playerId, achievement: id, score: crossing._id, earned: crossing.created });
  }

  if (records.length > 0) {
    try {
      await Achievement.insertMany(records, { ordered: false });
    } catch (err) {
      // Two Games of the same Player finishing together can both try to award one; the first write wins.
      if (err?.code !== DUPLICATE_KEY) throw err;
    }
  }
  return records.map(record => record.achievement);
};
