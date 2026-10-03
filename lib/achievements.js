import { achievementById, gamesPlayedAchievements, inGameAchievements, isGamePlayed } from '../game/achievements.js';
import { Achievement, Score } from '../schema/index.js';

const DUPLICATE_KEY = 11000;

// A Player's Games played, oldest first. Old Scores have no Hits, so the filter runs here rather than in the query.
export const listGamesPlayed = async playerId => {
  const scores = await Score.find({ player: playerId }, { score: 1, hits: 1, created: 1 }).sort({ created: 1, _id: 1 }).lean();
  return scores.filter(isGamePlayed);
};

export const listEarned = playerId => Achievement.find({ player: playerId }, { achievement: 1, earned: 1 }).lean();

const ownedBy = async playerId => new Set((await listEarned(playerId)).map(record => record.achievement));

// The Games-played steps the Player reached but doesn't hold. Each is dated by the Game played that crossed
// its threshold, which may be an old Score.
const ladderRecords = (playerId, gamesPlayed, owned) =>
  gamesPlayedAchievements(gamesPlayed.length)
    .filter(id => !owned.has(id))
    .map(id => {
      const crossing = gamesPlayed[achievementById(id).gamesPlayed - 1];
      return { player: playerId, achievement: id, score: crossing._id, earned: crossing.created };
    });

// Returns the ids actually written, so only the write that won a race announces the Achievement as new.
const insertRecords = async records => {
  if (records.length === 0) return [];
  try {
    await Achievement.insertMany(records, { ordered: false });
  } catch (err) {
    // Two Games of the same Player finishing together can both try to award one; the first write wins.
    if (err?.code !== DUPLICATE_KEY) throw err;
    return (err.insertedDocs ?? []).map(record => record.achievement);
  }
  return records.map(record => record.achievement);
};

/**
 * Award a Player the Achievements their just-saved Score earns, plus any Games-played step their older Scores
 * reached but never got. Returns the ids newly awarded, in display order.
 * `game` carries the finished Game's numbers: startingLevel, levelReached, flawlessClear, hits.
 */
export const awardAchievements = async ({ playerId, score, game }) => {
  const [gamesPlayed, owned] = await Promise.all([listGamesPlayed(playerId), ownedBy(playerId)]);
  const records = inGameAchievements(game)
    .filter(id => !owned.has(id))
    .map(id => ({ player: playerId, achievement: id, score: score._id, earned: score.created }));
  records.push(...ladderRecords(playerId, gamesPlayed, owned));
  return insertRecords(records);
};

/**
 * The one-time backfill from #26: grant a Player every Games-played step their existing Scores reached.
 * Idempotent. With `dryRun` nothing is written; the records that would be are returned instead.
 */
export const backfillGamesPlayed = async (playerId, { dryRun = false } = {}) => {
  const [gamesPlayed, owned] = await Promise.all([listGamesPlayed(playerId), ownedBy(playerId)]);
  const records = ladderRecords(playerId, gamesPlayed, owned);
  if (!dryRun) await insertRecords(records);
  return { gamesPlayed: gamesPlayed.length, records };
};
