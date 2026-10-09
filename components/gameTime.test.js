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

describe('gameTimeAfter a pause', () => {
  test('pause holds the time', () => {
    expect(after([['play', 1000], ['pause', 4000]])).toEqual({ start: 1000, end: 4000, paused: true });
  });

  test('resume carries on from where the pause held it', () => {
    expect(after([['play', 1000], ['pause', 4000], ['resume', 10000]])).toEqual({ start: 7000, end: null });
  });

  test('resume without a pause changes nothing', () => {
    expect(after([['play', 1000], ['resume', 4000]])).toEqual({ start: 1000, end: null });
    expect(after([['play', 1000], ['gameover', 4000], ['resume', 9000]])).toEqual({ start: 1000, end: 4000 });
  });

  test('gameover while paused finishes the Game at the pause', () => {
    expect(after([['play', 1000], ['pause', 4000], ['gameover', 10000]])).toEqual({ start: 1000, end: 4000 });
  });

  test('pause outside a running Game changes nothing', () => {
    expect(after([['pause', 1000]])).toEqual(NO_GAME);
    expect(after([['play', 1000], ['gameover', 4000], ['pause', 5000]])).toEqual({ start: 1000, end: 4000 });
  });
});
