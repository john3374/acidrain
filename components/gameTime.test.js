import { describe, expect, test } from 'vitest';

import { NO_GAME, gameTimeAfter } from './gameTime.js';

// Feed the socket `state` commands in order, each with the time it arrived.
const after = cmds => cmds.reduce((time, [cmd, now]) => gameTimeAfter(time, cmd, now), NO_GAME);

describe('gameTimeAfter', () => {
  test('there is no Game before the first play', () => {
    expect(after([['restart', 1000], ['sReady', 2000], ['gameover', 3000]])).toEqual(NO_GAME);
  });

  test('the first play after Level select starts the Game', () => {
    expect(after([['play', 1000]])).toEqual({ start: 1000, end: null });
  });

  test('a Level clear keeps the Game running', () => {
    expect(after([['play', 1000], ['sReady', 5000], ['play', 9000]])).toEqual({ start: 1000, end: null });
  });

  test('gameover finishes the Game', () => {
    expect(after([['play', 1000], ['gameover', 7000]])).toEqual({ start: 1000, end: 7000 });
  });

  test('a finished Game stays finished', () => {
    expect(after([['play', 1000], ['gameover', 7000], ['gameover', 8000], ['restart', 9000]])).toEqual({ start: 1000, end: 7000 });
  });

  test('the next play starts a new Game', () => {
    expect(after([['play', 1000], ['gameover', 7000], ['play', 20000]])).toEqual({ start: 20000, end: null });
  });
});
