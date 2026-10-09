import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const saved = [];

vi.mock('../schema/index.js', () => {
  class Score {
    constructor(fields) {
      Object.assign(this, fields);
    }
    save() {
      const { score, player, started, pageLoadId, startingLevel, levelReached, hits, typos } = this;
      saved.push({ score, player, started, pageLoadId, startingLevel, levelReached, hits, typos });
      return Promise.resolve(this);
    }
  }
  return {
    Game: { updateOne: vi.fn(() => Promise.resolve()) },
    Word: { aggregate: vi.fn(() => Promise.resolve([{ word: 'acid' }, { word: 'rain' }])) },
    Player: { exists: vi.fn() },
    Score,
  };
});

vi.mock('../lib/achievements.js', () => ({ awardAchievements: vi.fn(() => Promise.resolve([])) }));

import { awardAchievements } from '../lib/achievements.js';
import { Player } from '../schema/index.js';
import Game from './Game.js';

const PLAYER_ID = '64f1c2d3e4a5b6c7d8e9f0a1';

const makeClient = playerId => ({ gameId: 'g1', width: 800, charWidth: 10, playerId, on: vi.fn(), emit: vi.fn() });

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('Game.recordScore', () => {
  beforeEach(() => {
    saved.length = 0;
    Player.exists.mockReset();
  });

  test('saves the Score under the Player when the Player exists', async () => {
    Player.exists.mockResolvedValue({ _id: PLAYER_ID });
    const game = new Game(makeClient(PLAYER_ID), 1);
    game.score = 1234;

    game.recordScore();
    game.resetGame();
    await flush();

    expect(Player.exists).toHaveBeenCalledTimes(1);
    expect(String(Player.exists.mock.calls[0][0]._id)).toBe(PLAYER_ID);
    expect(saved).toHaveLength(1);
    expect(saved[0].score).toBe(1234);
    expect(String(saved[0].player)).toBe(PLAYER_ID);
  });

  test('saves a Guest Score when the Player no longer exists', async () => {
    Player.exists.mockResolvedValue(null);
    const game = new Game(makeClient(PLAYER_ID), 1);
    game.score = 500;

    game.recordScore();
    game.resetGame();
    await flush();

    expect(saved).toEqual([expect.objectContaining({ score: 500, player: undefined, started: undefined, pageLoadId: 'g1' })]);
  });

  test('saves a Guest Score without asking the database when the socket has no playerId', async () => {
    const game = new Game(makeClient(undefined), 1);
    game.score = 77;

    game.recordScore();
    await flush();

    expect(Player.exists).not.toHaveBeenCalled();
    expect(saved).toEqual([expect.objectContaining({ score: 77, player: undefined, started: undefined, pageLoadId: 'g1' })]);
  });

  test('saves a Guest Score and logs when the Player lookup fails', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    Player.exists.mockRejectedValue(new Error('db down'));
    const game = new Game(makeClient(PLAYER_ID), 1);
    game.score = 90;

    game.recordScore();
    await flush();

    expect(saved).toEqual([expect.objectContaining({ score: 90, player: undefined, started: undefined, pageLoadId: 'g1' })]);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  test('records a Score only once per Game', async () => {
    Player.exists.mockResolvedValue({ _id: PLAYER_ID });
    const game = new Game(makeClient(PLAYER_ID), 1);

    game.recordScore();
    game.recordScore();
    await flush();

    expect(saved).toHaveLength(1);
  });
});

describe('Game start time and page-load ID on the Score', () => {
  const T0 = new Date('2026-10-01T03:00:00Z');

  beforeEach(() => {
    saved.length = 0;
    Player.exists.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Starts a Level and stops it again, as a Level clear does.
  const playLevel = game => {
    game.start();
    game.stop();
  };

  test("a Guest Score saves the Game's start time and the page-load ID", async () => {
    const game = new Game(makeClient(undefined), 1);
    playLevel(game);
    vi.setSystemTime(new Date(T0.getTime() + 60_000));

    game.recordScore();
    game.resetGame();
    await flush();

    expect(saved).toHaveLength(1);
    expect(saved[0].started).toEqual(T0);
    expect(saved[0].pageLoadId).toBe('g1');
  });

  test("a Player Score saves the Game's start time but no page-load ID", async () => {
    Player.exists.mockResolvedValue({ _id: PLAYER_ID });
    const game = new Game(makeClient(PLAYER_ID), 1);
    playLevel(game);

    game.recordScore();
    await flush();

    expect(saved[0].started).toEqual(T0);
    expect(saved[0].pageLoadId).toBeUndefined();
  });

  test('a Score saved as a Guest Score because the Player is gone gets the page-load ID', async () => {
    Player.exists.mockResolvedValue(null);
    const game = new Game(makeClient(PLAYER_ID), 1);
    playLevel(game);

    game.recordScore();
    await flush();

    expect(saved[0].player).toBeUndefined();
    expect(saved[0].pageLoadId).toBe('g1');
  });

  test("later Levels keep the first Level's start time", async () => {
    const game = new Game(makeClient(undefined), 1);
    playLevel(game);
    vi.setSystemTime(new Date(T0.getTime() + 120_000));
    playLevel(game);

    game.recordScore();
    await flush();

    expect(saved[0].started).toEqual(T0);
  });

  test('the next Game gets its own start time', async () => {
    const game = new Game(makeClient(undefined), 1);
    playLevel(game);
    game.recordScore();
    game.resetGame();

    const second = new Date(T0.getTime() + 300_000);
    vi.setSystemTime(second);
    playLevel(game);
    game.recordScore();
    await flush();

    expect(saved.map(s => s.started)).toEqual([T0, second]);
  });

  test('choosing a new Level clears the start time', async () => {
    const game = new Game(makeClient(undefined), 1);
    playLevel(game);
    game.resetGame();

    game.recordScore();
    await flush();

    expect(saved[0].started).toBeUndefined();
  });
});

describe("the Game's numbers and Achievements at Game finish", () => {
  beforeEach(() => {
    saved.length = 0;
    Player.exists.mockReset();
    awardAchievements.mockClear();
  });

  const resultOf = client => client.emit.mock.calls.filter(([event]) => event === 'result').map(([, payload]) => payload);

  test('the Score records the starting Level, the Level reached, Hits and Typos', async () => {
    const game = new Game(makeClient(undefined), 3);
    game.start();
    game.levelClear();
    game.start();
    game.correct = 7;
    game.incorrect = 2;

    game.recordScore();
    game.resetGame();
    await flush();

    expect(saved[0]).toMatchObject({ startingLevel: 3, levelReached: 4, hits: 7, typos: 2 });
  });

  test('a Game that never started records its chosen Level as both starting Level and Level reached', async () => {
    const game = new Game(makeClient(undefined), 6);

    game.recordScore();
    await flush();

    expect(saved[0]).toMatchObject({ startingLevel: 6, levelReached: 6, hits: 0, typos: 0 });
  });

  test('a Guest gets the in-Game Achievements the Game met, marked as a Guest, and nothing is awarded', async () => {
    const client = makeClient(undefined);
    const game = new Game(client, 5);
    game.start();
    game.correct = 20;
    game.levelClear();

    game.recordScore();
    await flush();

    expect(resultOf(client)).toEqual([{ sequence: 1, achievements: ['first-clear', 'level-5', 'flawless'], guest: true }]);
    expect(awardAchievements).not.toHaveBeenCalled();
  });

  test('a Player is awarded from the saved Score and told what was new', async () => {
    Player.exists.mockResolvedValue({ _id: PLAYER_ID });
    awardAchievements.mockResolvedValueOnce(['first-clear', 'games-10']);
    const client = makeClient(PLAYER_ID);
    const game = new Game(client, 1);
    game.start();
    game.correct = 4;
    game.levelClear();

    game.recordScore();
    await flush();

    expect(awardAchievements).toHaveBeenCalledTimes(1);
    const [{ playerId, score, game: facts }] = awardAchievements.mock.calls[0];
    expect(String(playerId)).toBe(PLAYER_ID);
    expect(String(score.player)).toBe(PLAYER_ID);
    expect(facts).toEqual({ startingLevel: 1, levelReached: 2, flawlessClear: false, hits: 4, typos: 0 });
    expect(resultOf(client)).toEqual([{ sequence: 1, achievements: ['first-clear', 'games-10'], guest: false }]);
  });

  test('each finished Game on a connection gets the next sequence number', async () => {
    const client = makeClient(undefined);
    const game = new Game(client, 1);

    game.recordScore();
    game.resetGame();
    game.recordScore();
    await flush();

    expect(resultOf(client).map(r => r.sequence)).toEqual([1, 2]);
  });

  test('a Player whose award fails gets no result, and the Score is still saved', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    Player.exists.mockResolvedValue({ _id: PLAYER_ID });
    awardAchievements.mockRejectedValueOnce(new Error('db down'));
    const client = makeClient(PLAYER_ID);
    const game = new Game(client, 1);

    game.recordScore();
    await flush();

    expect(saved).toHaveLength(1);
    expect(resultOf(client)).toEqual([]);
    expect(log).toHaveBeenCalledWith('failed to award achievements', expect.any(Error));
    log.mockRestore();
  });

  describe('무결점', () => {
    const finish = game => {
      const client = game.client;
      game.recordScore();
      return flush().then(() => resultOf(client)[0].achievements.includes('flawless'));
    };
    const start = level => {
      const client = makeClient(undefined);
      const game = new Game(client, level);
      game.client = client;
      game.start();
      return game;
    };

    test('a Typo during the Level loses it', async () => {
      const game = start(5);
      game.incorrect++;
      game.levelClear();
      expect(await finish(game)).toBe(false);
    });

    test('a word landing during the Level loses it', async () => {
      const game = start(5);
      game.life--;
      game.levelClear();
      expect(await finish(game)).toBe(false);
    });

    test('a Level below 5 does not count', async () => {
      const game = start(4);
      game.levelClear();
      expect(await finish(game)).toBe(false);
    });

    test('an earlier Typo does not spoil a later clean Level', async () => {
      const game = start(4);
      game.incorrect++;
      game.levelClear();
      game.start();
      game.levelClear();
      expect(await finish(game)).toBe(true);
    });

    test('once earned in a Game it stays earned, and the next Game starts clean', async () => {
      const game = start(5);
      game.levelClear();
      game.start();
      game.incorrect++;
      game.levelClear();
      expect(await finish(game)).toBe(true);

      game.resetGame();
      game.client.emit.mockClear();
      game.level = 5;
      game.start();
      game.incorrect++;
      game.levelClear();
      expect(await finish(game)).toBe(false);
    });
  });
});

describe('an abandoned Game', () => {
  beforeEach(() => {
    saved.length = 0;
    Player.exists.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('stops dropping words and never saves a Score or sends a result', async () => {
    const client = makeClient(undefined);
    const game = new Game(client, 1);
    await vi.advanceTimersByTimeAsync(0); // words loaded
    game.start();
    game.life = 0;
    await vi.advanceTimersByTimeAsync(5_000);
    const emitsBefore = client.emit.mock.calls.length;

    game.abandon();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    game.recordScore();
    await vi.advanceTimersByTimeAsync(0);

    expect(client.emit.mock.calls.length).toBe(emitsBefore);
    expect(client.emit).not.toHaveBeenCalledWith('state', 'gameover');
    expect(saved).toEqual([]);
  });

  test('a running Game left alone does run out of pH and record, so the test above means something', async () => {
    const client = makeClient(undefined);
    const game = new Game(client, 1);
    await vi.advanceTimersByTimeAsync(0);
    game.start();
    game.life = 0;

    await vi.advanceTimersByTimeAsync(60 * 60_000);

    expect(client.emit).toHaveBeenCalledWith('state', 'gameover');
    expect(saved).toHaveLength(1);
  });
});

describe('a paused Game', () => {
  beforeEach(() => {
    saved.length = 0;
    Player.exists.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const startedGame = async () => {
    const client = makeClient(undefined);
    const game = new Game(client, 1);
    await vi.advanceTimersByTimeAsync(0); // words loaded
    game.start();
    await vi.advanceTimersByTimeAsync(5_000);
    return { client, game, submit: client.on.mock.calls.find(([event]) => event === 'game')[1] };
  };

  test('drops no words and loses no pH until it resumes', async () => {
    const { client, game } = await startedGame();
    game.life = 0;

    expect(game.pause()).toBe(true);
    const emitsBefore = client.emit.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60 * 60_000);

    expect(client.emit.mock.calls.length).toBe(emitsBefore);
    expect(saved).toEqual([]);

    expect(game.resume()).toBe(true);
    await vi.advanceTimersByTimeAsync(60 * 60_000);

    expect(client.emit).toHaveBeenCalledWith('state', 'gameover');
    expect(saved).toHaveLength(1);
  });

  test('ignores words typed while paused, so a pause gives no free Hits', async () => {
    const { game, submit } = await startedGame();
    const { position, correct, incorrect } = game.getState();
    expect(position.length).toBeGreaterThan(0);

    game.pause();
    submit(position[0].word);
    submit('nope');

    expect(game.getState()).toMatchObject({ correct, incorrect });
  });

  test('cannot pause between Levels, when nothing is falling', async () => {
    const { game } = await startedGame();
    game.levelClear();

    expect(game.pause()).toBe(false);
    expect(game.resume()).toBe(false);
  });

  test('a Game finished while paused starts the next one unpaused', async () => {
    const { game } = await startedGame();
    game.pause();
    game.stop();
    game.resetGame();
    await vi.advanceTimersByTimeAsync(0);

    game.start();

    expect(game.status()).toBeTruthy();
    expect(game.resume()).toBe(false);
  });
});
