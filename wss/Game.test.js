import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const saved = [];

vi.mock('../schema/index.js', () => {
  class Score {
    constructor(fields) {
      Object.assign(this, fields);
    }
    save() {
      saved.push({ score: this.score, player: this.player, started: this.started, pageLoadId: this.pageLoadId });
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

    expect(saved).toEqual([{ score: 500, player: undefined, started: undefined, pageLoadId: 'g1' }]);
  });

  test('saves a Guest Score without asking the database when the socket has no playerId', async () => {
    const game = new Game(makeClient(undefined), 1);
    game.score = 77;

    game.recordScore();
    await flush();

    expect(Player.exists).not.toHaveBeenCalled();
    expect(saved).toEqual([{ score: 77, player: undefined, started: undefined, pageLoadId: 'g1' }]);
  });

  test('saves a Guest Score and logs when the Player lookup fails', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    Player.exists.mockRejectedValue(new Error('db down'));
    const game = new Game(makeClient(PLAYER_ID), 1);
    game.score = 90;

    game.recordScore();
    await flush();

    expect(saved).toEqual([{ score: 90, player: undefined, started: undefined, pageLoadId: 'g1' }]);
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
