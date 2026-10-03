import { beforeEach, describe, expect, test, vi } from 'vitest';

const db = { scores: [], earned: [] };

vi.mock('../schema/index.js', () => {
  const query = result => ({ sort: () => ({ lean: () => Promise.resolve(result) }), lean: () => Promise.resolve(result) });
  return {
    Score: { find: vi.fn(() => query(db.scores)) },
    Achievement: { find: vi.fn(() => query(db.earned)), insertMany: vi.fn(() => Promise.resolve()) },
  };
});

import { Achievement } from '../schema/index.js';
import { awardAchievements, backfillGamesPlayed } from './achievements.js';

const PLAYER = 'p1';
const T0 = Date.parse('2026-09-01T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

// `n` old Games played, one a day, oldest first.
const oldGames = (n, fields = { hits: 3 }) => Array.from({ length: n }, (_, i) => ({ _id: `s${i + 1}`, score: 500, created: new Date(T0 + i * DAY), ...fields }));

const thisScore = { _id: 'now', score: 300, hits: 2, created: new Date('2026-10-03T00:00:00Z') };
const quietGame = { startingLevel: 1, levelReached: 1, flawlessClear: false, hits: 2 };

const inserted = () => Achievement.insertMany.mock.calls.flatMap(call => call[0]);

beforeEach(() => {
  db.scores = [];
  db.earned = [];
  Achievement.insertMany.mockClear();
});

describe('awardAchievements', () => {
  test('a first Game that clears Level 1 earns 첫 걸음, dated by this Score', async () => {
    db.scores = [thisScore];

    const awarded = await awardAchievements({ playerId: PLAYER, score: thisScore, game: { ...quietGame, levelReached: 2 } });

    expect(awarded).toEqual(['first-clear']);
    expect(inserted()).toEqual([{ player: PLAYER, achievement: 'first-clear', score: 'now', earned: thisScore.created }]);
  });

  test('a Game with no clear and no threshold crossed awards nothing and writes nothing', async () => {
    db.scores = [...oldGames(3), thisScore];

    expect(await awardAchievements({ playerId: PLAYER, score: thisScore, game: quietGame })).toEqual([]);
    expect(Achievement.insertMany).not.toHaveBeenCalled();
  });

  test('the tenth Game played earns 10판 달성, dated by that Game', async () => {
    db.scores = [...oldGames(9), thisScore];

    expect(await awardAchievements({ playerId: PLAYER, score: thisScore, game: quietGame })).toEqual(['games-10']);
    expect(inserted()).toEqual([{ player: PLAYER, achievement: 'games-10', score: 'now', earned: thisScore.created }]);
  });

  test('a Player with many old Games gets every missing ladder step, each dated by the Score that crossed it', async () => {
    const old = oldGames(60);
    db.scores = [...old, thisScore];

    expect(await awardAchievements({ playerId: PLAYER, score: thisScore, game: quietGame })).toEqual(['games-10', 'games-50']);
    expect(inserted()).toEqual([
      { player: PLAYER, achievement: 'games-10', score: 's10', earned: old[9].created },
      { player: PLAYER, achievement: 'games-50', score: 's50', earned: old[49].created },
    ]);
  });

  test('Achievements the Player already holds are not awarded again', async () => {
    db.scores = [...oldGames(12), thisScore];
    db.earned = [{ achievement: 'games-10' }, { achievement: 'first-clear' }];

    const awarded = await awardAchievements({ playerId: PLAYER, score: thisScore, game: { ...quietGame, startingLevel: 5, levelReached: 6 } });

    expect(awarded).toEqual(['level-5']);
  });

  test('old Scores without Hits count as Games played unless their points show no Hit', async () => {
    const noHits = oldGames(5, {}).map(score => ({ ...score, score: 860 })); // Level 2 start, no Hits
    db.scores = [...oldGames(9, {}), ...noHits, thisScore];

    expect(await awardAchievements({ playerId: PLAYER, score: thisScore, game: quietGame })).toEqual(['games-10']);
  });

  test('a duplicate-key error from a concurrent award is swallowed; other errors are not', async () => {
    db.scores = [thisScore];
    const game = { ...quietGame, levelReached: 2 };

    Achievement.insertMany.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000, insertedDocs: [] }));
    await expect(awardAchievements({ playerId: PLAYER, score: thisScore, game })).resolves.toEqual([]);

    Achievement.insertMany.mockRejectedValueOnce(new Error('db down'));
    await expect(awardAchievements({ playerId: PLAYER, score: thisScore, game })).rejects.toThrow('db down');
  });
});

describe('awardAchievements under a race', () => {
  test('announces only the Achievements this write actually inserted', async () => {
    db.scores = [...oldGames(9), thisScore];
    const game = { ...quietGame, levelReached: 2 }; // first-clear and games-10 both due
    Achievement.insertMany.mockRejectedValueOnce(
      Object.assign(new Error('dup'), { code: 11000, insertedDocs: [{ achievement: 'games-10' }] })
    );

    expect(await awardAchievements({ playerId: PLAYER, score: thisScore, game })).toEqual(['games-10']);
  });
});

describe('backfillGamesPlayed', () => {
  test('grants every missing ladder step from existing Scores, dated by the crossing Score', async () => {
    const old = oldGames(55);
    db.scores = old;
    db.earned = [{ achievement: 'games-10' }];

    const { gamesPlayed, records } = await backfillGamesPlayed(PLAYER);

    expect(gamesPlayed).toBe(55);
    expect(records).toEqual([{ player: PLAYER, achievement: 'games-50', score: 's50', earned: old[49].created }]);
    expect(inserted()).toEqual(records);
  });

  test('a dry run reports the same records but writes nothing', async () => {
    db.scores = oldGames(12);

    const { records } = await backfillGamesPlayed(PLAYER, { dryRun: true });

    expect(records.map(r => r.achievement)).toEqual(['games-10']);
    expect(Achievement.insertMany).not.toHaveBeenCalled();
  });

  test('a Player with nothing to grant writes nothing', async () => {
    db.scores = oldGames(3);

    expect((await backfillGamesPlayed(PLAYER)).records).toEqual([]);
    expect(Achievement.insertMany).not.toHaveBeenCalled();
  });
});
