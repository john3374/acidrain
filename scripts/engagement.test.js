import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

// The script is plain CommonJS so mongosh can run it as is.
const require = createRequire(import.meta.url);
const { seoulWeek, isGamePlayed, engagementByWeek, formatTable } = require('./engagement.js');

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Wednesday 2026-09-30 12:00 in Seoul.
const WED = new Date('2026-09-30T03:00:00Z');
const at = ms => new Date(WED.getTime() + ms);

const playerScore = (player, created, started, extra = {}) => ({ player, score: 500, created, started, ...extra });
const guestScore = (pageLoadId, created, started, extra = {}) => ({ score: 500, created, started, pageLoadId, ...extra });

describe('seoulWeek', () => {
  test('weeks start on Monday in Asia/Seoul', () => {
    expect(seoulWeek(WED)).toBe('2026-09-28');
    // Sunday 23:59 Seoul is still the week before.
    expect(seoulWeek(new Date('2026-09-27T14:59:00Z'))).toBe('2026-09-21');
    // Monday 00:00 Seoul is Sunday 15:00 UTC.
    expect(seoulWeek(new Date('2026-09-27T15:00:00Z'))).toBe('2026-09-28');
  });
});

describe('isGamePlayed', () => {
  test('uses Hits when the Score has them', () => {
    expect(isGamePlayed({ score: 5, hits: 1 })).toBe(true);
    expect(isGamePlayed({ score: 500, hits: 0 })).toBe(false);
  });

  test('without Hits, a Score within 10 above a multiple of 850 had no Hits', () => {
    expect(isGamePlayed({ score: 0 })).toBe(false);
    expect(isGamePlayed({ score: 10 })).toBe(false);
    expect(isGamePlayed({ score: 860 })).toBe(false);
    expect(isGamePlayed({ score: 7660 })).toBe(false);
    expect(isGamePlayed({ score: 11 })).toBe(true);
    expect(isGamePlayed({ score: 849 })).toBe(true);
  });
});

describe('engagementByWeek', () => {
  const now = at(30 * DAY);

  test('counts Games played for Players and Guests, skipping Games with no Hits', () => {
    const [row] = engagementByWeek(
      [playerScore('a', at(0), at(-MIN)), playerScore('a', at(HOUR), at(HOUR - MIN), { score: 10 }), guestScore('g', at(0), at(-MIN))],
      now,
    );
    expect(row).toMatchObject({ week: '2026-09-28', playerGames: 1, guestGames: 1, activePlayers: 1, gamesPerActivePlayer: 1 });
  });

  test("Replay rate: a Game is followed by a Replay when the same player's next Game starts within 5 minutes of its finish", () => {
    const [row] = engagementByWeek(
      [
        playerScore('a', at(0), at(-MIN)),
        playerScore('a', at(10 * MIN), at(4 * MIN)), // Replay of the first
        playerScore('a', at(30 * MIN), at(16 * MIN)), // 6 minutes later: not a Replay
        guestScore('g', at(0), at(-MIN)),
        guestScore('g', at(5 * MIN), at(2 * MIN)), // Replay within the same page load
        guestScore('h', at(4 * MIN), at(3 * MIN)), // another page load: not g's Replay
      ],
      now,
    );
    // Followed by a Replay: a@0 and g@0, out of six Games played.
    expect(row.replayRate).toBeCloseTo(2 / 6);
  });

  test('Scores without a start time are left out of the Replay rate', () => {
    const [row] = engagementByWeek(
      [playerScore('a', at(0), undefined), playerScore('a', at(2 * MIN), undefined), playerScore('b', at(0), at(-MIN))],
      now,
    );
    expect(row.replayRate).toBe(0);

    const [old] = engagementByWeek([playerScore('a', at(0), undefined), guestScore(undefined, at(0), at(-MIN))], now);
    expect(old.replayRate).toBeNull();
  });

  test('Returning Players: Active Players with a Game started at least 12 hours after their previous Game', () => {
    const rows = engagementByWeek(
      [
        playerScore('a', at(-7 * DAY), undefined), // previous week, old Score: created stands in for the start
        playerScore('a', at(0), at(-MIN)), // Return visit
        playerScore('b', at(0), at(-MIN)),
        playerScore('b', at(11 * HOUR), at(11 * HOUR - MIN)), // 11 hours later: no Return visit
        playerScore('c', at(0), at(-MIN)), // first Game ever
        playerScore('d', at(-1 * HOUR), at(-2 * HOUR)),
        playerScore('d', at(12 * HOUR), at(12 * HOUR - MIN)), // started 13 hours after d's previous Game finished
      ],
      now,
    );
    const week = rows.find(r => r.week === '2026-09-28');
    expect(week.activePlayers).toBe(4);
    expect(week.returningRate).toBeCloseTo(2 / 4);
  });

  test('a Game with no Hits still counts as the previous Game for a Return visit', () => {
    const [row] = engagementByWeek(
      [
        playerScore('a', at(-13 * HOUR), at(-13 * HOUR - MIN)),
        playerScore('a', at(-2 * HOUR), at(-2 * HOUR - MIN), { score: 5 }), // 11 hours later, no Hits
        playerScore('a', at(0), at(-MIN)), // 13 hours after the first Game, but 2 after the no-Hit one
      ],
      now,
    );
    expect(row.returningRate).toBe(0);
  });

  test('a Return visit whose first Game has no Hits still makes the Player returning', () => {
    const rows = engagementByWeek(
      [
        playerScore('a', at(-7 * DAY), at(-7 * DAY - MIN)),
        playerScore('a', at(0), at(-MIN), { score: 5 }), // back after a week, no Hits
        playerScore('a', at(10 * MIN), at(MIN)),
      ],
      now,
    );
    expect(rows.find(r => r.week === '2026-09-28').returningRate).toBe(1);
  });

  test('a Replay with no Hits still counts, and the Game after it is compared with the Replay', () => {
    const [row] = engagementByWeek(
      [
        playerScore('a', at(0), at(-MIN)),
        playerScore('a', at(3 * MIN), at(2 * MIN), { score: 10 }), // Replay with no Hits
        playerScore('a', at(10 * MIN), at(6 * MIN)), // Replay of the no-Hit Game, 6 minutes after the first
      ],
      now,
    );
    // Two Games played, the first followed by a Replay; the no-Hit Game isn't counted itself.
    expect(row.replayRate).toBe(1 / 2);
  });

  test('New-Player 7-day return: Players whose first Game played fell in the week, with a Return visit within 7 days', () => {
    const rows = engagementByWeek(
      [
        playerScore('old', at(-14 * DAY), at(-14 * DAY - MIN)),
        playerScore('old', at(0), at(-MIN)),
        playerScore('a', at(0), at(-MIN)),
        playerScore('a', at(DAY), at(DAY - MIN)), // returns next day
        playerScore('b', at(0), at(-MIN)),
        playerScore('b', at(8 * DAY), at(8 * DAY - MIN)), // returns after 8 days: too late
        playerScore('c', at(0), at(-MIN)), // never returns
      ],
      now,
    );
    const week = rows.find(r => r.week === '2026-09-28');
    expect(week.newPlayerReturn).toBeCloseTo(1 / 3);
    expect(week.newPlayerReturnComplete).toBe(true);
  });

  test("the New-Player 7-day return is marked incomplete while the week's 7-day window is still open", () => {
    const [row] = engagementByWeek([playerScore('a', at(0), at(-MIN))], at(3 * DAY));
    expect(row.newPlayerReturnComplete).toBe(false);
  });

  test('weeks with no new Players have no New-Player 7-day return', () => {
    const rows = engagementByWeek([playerScore('a', at(-7 * DAY), at(-7 * DAY - MIN)), playerScore('a', at(0), at(-MIN))], now);
    expect(rows.map(r => r.week)).toEqual(['2026-09-21', '2026-09-28']);
    expect(rows[1].newPlayerReturn).toBeNull();
  });
});

describe('formatTable', () => {
  test('prints one row per week, with — for missing rates', () => {
    const out = formatTable([
      {
        week: '2026-09-28',
        playerGames: 3,
        guestGames: 2,
        replayRate: null,
        activePlayers: 2,
        gamesPerActivePlayer: 1.5,
        returningRate: 0.5,
        newPlayerReturn: 1 / 3,
        newPlayerReturnComplete: false,
      },
    ]);
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/^Week/);
    expect(lines[1]).toMatch(/^2026-09-28\s+3\s+2\s+—\s+2\s+1\.5\s+50%\s+33%\*/);
  });

  test('Games per active Player is — in a week with no Active Players', () => {
    const out = formatTable([
      {
        week: '2026-09-28',
        playerGames: 0,
        guestGames: 4,
        replayRate: 0.25,
        activePlayers: 0,
        gamesPerActivePlayer: null,
        returningRate: null,
        newPlayerReturn: null,
        newPlayerReturnComplete: true,
      },
    ]);
    expect(out.split('\n')[1]).toMatch(/^2026-09-28\s+0\s+4\s+25%\s+0\s+—\s+—\s+—/);
  });
});
