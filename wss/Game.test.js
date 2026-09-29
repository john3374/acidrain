import { beforeEach, describe, expect, test, vi } from 'vitest';

const saved = [];

vi.mock('../schema/index.js', () => {
  class Score {
    constructor(fields) {
      Object.assign(this, fields);
    }
    save() {
      saved.push({ score: this.score, player: this.player });
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

    expect(saved).toEqual([{ score: 500, player: undefined }]);
  });

  test('saves a Guest Score without asking the database when the socket has no playerId', async () => {
    const game = new Game(makeClient(undefined), 1);
    game.score = 77;

    game.recordScore();
    await flush();

    expect(Player.exists).not.toHaveBeenCalled();
    expect(saved).toEqual([{ score: 77, player: undefined }]);
  });

  test('saves a Guest Score and logs when the Player lookup fails', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    Player.exists.mockRejectedValue(new Error('db down'));
    const game = new Game(makeClient(PLAYER_ID), 1);
    game.score = 90;

    game.recordScore();
    await flush();

    expect(saved).toEqual([{ score: 90, player: undefined }]);
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
