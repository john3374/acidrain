import { describe, expect, test } from 'vitest';

import { ACHIEVEMENTS, gamesPlayedAchievements, inGameAchievements, isGamePlayed, nextGamesPlayedThreshold } from './achievements.js';

const game = (startingLevel, levelReached, flawlessClear = false) => ({ startingLevel, levelReached, flawlessClear });

describe('the first set', () => {
  test('is the eight Achievements decided in #26, with unique ids', () => {
    expect(ACHIEVEMENTS.map(a => a.name)).toEqual(['첫 걸음', '5마당 돌파', '10마당 돌파', '완주', '무결점', '10판 달성', '50판 달성', '100판 달성']);
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(8);
  });
});

describe('inGameAchievements', () => {
  test('a Game that ends in its first Level earns nothing', () => {
    expect(inGameAchievements(game(1, 1))).toEqual([]);
    expect(inGameAchievements(game(10, 10))).toEqual([]);
  });

  test('clearing any Level earns 첫 걸음', () => {
    expect(inGameAchievements(game(1, 2))).toEqual(['first-clear']);
    expect(inGameAchievements(game(3, 4))).toEqual(['first-clear']);
  });

  test('clearing Level 5 earns 5마당 돌파, whether the Game started there or got there', () => {
    expect(inGameAchievements(game(5, 6))).toEqual(['first-clear', 'level-5']);
    expect(inGameAchievements(game(2, 7))).toEqual(['first-clear', 'level-5']);
  });

  test('dying in Level 5 does not clear it', () => {
    expect(inGameAchievements(game(1, 5))).toEqual(['first-clear']);
  });

  test('clearing Level 10 earns 10마당 돌파; 완주 needs a start at Level 1', () => {
    expect(inGameAchievements(game(10, 11))).toEqual(['first-clear', 'level-10']);
    expect(inGameAchievements(game(6, 11))).toEqual(['first-clear', 'level-10']);
    expect(inGameAchievements(game(1, 11))).toEqual(['first-clear', 'level-5', 'level-10', 'full-run']);
  });

  test('a flawless clear of Level 5 or higher earns 무결점', () => {
    expect(inGameAchievements(game(5, 6, true))).toEqual(['first-clear', 'level-5', 'flawless']);
    expect(inGameAchievements(game(1, 2, false))).toEqual(['first-clear']);
  });
});

describe('the Games-played ladder', () => {
  test('a Game played needs at least one Hit', () => {
    expect(isGamePlayed({ hits: 1, score: 5 })).toBe(true);
    expect(isGamePlayed({ hits: 0, score: 7660 })).toBe(false);
  });

  test('an old Score without Hits counts unless it lies within 10 above a multiple of the Level bonus', () => {
    expect(isGamePlayed({ score: 10 })).toBe(false);
    expect(isGamePlayed({ score: 7660 })).toBe(false);
    expect(isGamePlayed({ score: 11 })).toBe(true);
    expect(isGamePlayed({ score: 500 })).toBe(true);
  });

  test('gamesPlayedAchievements lists every step reached', () => {
    expect(gamesPlayedAchievements(9)).toEqual([]);
    expect(gamesPlayedAchievements(10)).toEqual(['games-10']);
    expect(gamesPlayedAchievements(60)).toEqual(['games-10', 'games-50']);
    expect(gamesPlayedAchievements(100)).toEqual(['games-10', 'games-50', 'games-100']);
  });

  test('nextGamesPlayedThreshold points at the next step until the ladder is done', () => {
    expect(nextGamesPlayedThreshold(0)).toBe(10);
    expect(nextGamesPlayedThreshold(10)).toBe(50);
    expect(nextGamesPlayedThreshold(99)).toBe(100);
    expect(nextGamesPlayedThreshold(100)).toBeNull();
  });
});
