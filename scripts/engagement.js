/* global db, print */
// Weekly engagement: Games played, Replays and Return visits (see GLOSSARY.md), one row per week.
//
// Usage: mongosh "mongodb+srv://<user>:<password>@<host>/acidrain" scripts/engagement.js
//
// Weeks start on Monday in Asia/Seoul. Only Games played count: a finished Game with at least one Hit.
// Plain CommonJS so mongosh can run it as is and the tests can require it.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const SEOUL_OFFSET = 9 * HOUR; // Asia/Seoul has no daylight saving.
const REPLAY_WINDOW = 5 * MINUTE;
const RETURN_GAP = 12 * HOUR;
const NEW_PLAYER_WINDOW = 7 * DAY;
const LEVEL_BONUS_STEP = 850; // The Level bonus per Level above 1, as in wss/wss.js.
const NO_HIT_MAX = 10;

// The instant a week starts: Monday 00:00 in Seoul.
function seoulWeekStart(date) {
  const local = new Date(date).getTime() + SEOUL_OFFSET;
  const dayStart = Math.floor(local / DAY) * DAY;
  const daysSinceMonday = (new Date(dayStart).getUTCDay() + 6) % 7;
  return dayStart - daysSinceMonday * DAY - SEOUL_OFFSET;
}

// The Seoul date of the week's Monday, e.g. '2026-09-28'.
function seoulWeek(date) {
  return new Date(seoulWeekStart(date) + SEOUL_OFFSET).toISOString().slice(0, 10);
}

// Scores without Hits: a Game with no Hits scores 0–10 plus the Level bonus, and a Hit is worth at least 30.
function isGamePlayed(score) {
  if (typeof score.hits === 'number') return score.hits > 0;
  return score.score % LEVEL_BONUS_STEP > NO_HIT_MAX;
}

// Players by account, Guests by page load. Old Guest Scores have neither.
function playerKey(score) {
  if (score.player) return `player:${score.player}`;
  if (score.pageLoadId) return `guest:${score.pageLoadId}`;
  return null;
}

// Old Scores have no start time; their finish stands in for it.
const startOf = game => (game.started ?? game.created).getTime();

const isReplay = (game, next) => {
  if (!game.started || !next?.started) return false;
  const gap = next.started.getTime() - game.created.getTime();
  return gap >= 0 && gap <= REPLAY_WINDOW;
};

const isReturnVisit = (game, previous) => Boolean(previous) && startOf(game) - previous.created.getTime() >= RETURN_GAP;

const share = (count, total) => (total > 0 ? count / total : null);

function engagementByWeek(scores, now = new Date()) {
  // Every Score is a finished Game; only Games played are counted, but Replays and Return visits compare
  // each Game with the same player's Game just before or after it, played or not.
  const all = scores
    .map(s => ({ ...s, created: new Date(s.created), started: s.started ? new Date(s.started) : undefined, played: isGamePlayed(s) }))
    .sort((a, b) => a.created - b.created);

  const weeks = new Map();
  const weekOf = game => {
    const start = seoulWeekStart(game.created);
    if (!weeks.has(start)) {
      weeks.set(start, {
        start,
        playerGames: 0,
        guestGames: 0,
        replays: 0,
        replayGames: 0,
        activePlayers: new Set(),
        returningPlayers: new Set(),
        newPlayers: 0,
        newPlayersReturned: 0,
      });
    }
    return weeks.get(start);
  };

  const byPlayer = new Map();
  for (const game of all) {
    if (game.played) {
      const week = weekOf(game);
      if (game.player) {
        week.playerGames++;
        week.activePlayers.add(String(game.player));
      } else {
        week.guestGames++;
      }
    }
    const key = playerKey(game);
    if (key) {
      if (!byPlayer.has(key)) byPlayer.set(key, []);
      byPlayer.get(key).push(game);
    }
  }

  for (const list of byPlayer.values()) {
    list.forEach((game, i) => {
      if (!game.played || !game.started) return;
      const week = weekOf(game);
      week.replayGames++;
      if (isReplay(game, list[i + 1])) week.replays++;
    });

    if (!list[0].player) continue;
    const returnVisits = list.filter((game, i) => isReturnVisit(game, list[i - 1]));
    for (const game of returnVisits) {
      const week = weekOf(game);
      // Returning Players are a share of Active Players, so only count Players active that week.
      if (week.activePlayers.has(String(game.player))) week.returningPlayers.add(String(game.player));
    }

    const first = list.find(game => game.played);
    if (!first) continue;
    const firstWeek = weekOf(first);
    firstWeek.newPlayers++;
    const returned = returnVisits.some(game => startOf(game) > startOf(first) && startOf(game) - startOf(first) <= NEW_PLAYER_WINDOW);
    if (returned) firstWeek.newPlayersReturned++;
  }

  return [...weeks.values()]
    .sort((a, b) => a.start - b.start)
    .map(w => ({
      week: seoulWeek(w.start),
      playerGames: w.playerGames,
      guestGames: w.guestGames,
      replayRate: share(w.replays, w.replayGames),
      activePlayers: w.activePlayers.size,
      gamesPerActivePlayer: share(w.playerGames, w.activePlayers.size),
      returningRate: share(w.returningPlayers.size, w.activePlayers.size),
      newPlayerReturn: share(w.newPlayersReturned, w.newPlayers),
      // The last new Player of the week still has 7 days to return.
      newPlayerReturnComplete: w.start + 7 * DAY + NEW_PLAYER_WINDOW <= now.getTime(),
    }));
}

const COLUMNS = ['Week', 'Player games', 'Guest games', 'Replay rate', 'Active Players', 'Games/Player', 'Returning', 'New 7-day return'];

const percent = value => (value === null ? '—' : `${Math.round(value * 100)}%`);

function formatTable(rows) {
  const cells = rows.map(r => [
    r.week,
    String(r.playerGames),
    String(r.guestGames),
    percent(r.replayRate),
    String(r.activePlayers),
    r.gamesPerActivePlayer === null ? '—' : r.gamesPerActivePlayer.toFixed(1),
    percent(r.returningRate),
    percent(r.newPlayerReturn) + (r.newPlayerReturn !== null && !r.newPlayerReturnComplete ? '*' : ''),
  ]);
  const widths = COLUMNS.map((title, i) => Math.max(title.length, ...cells.map(row => row[i].length)));
  const line = row => row.map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  ');
  const lines = [line(COLUMNS), ...cells.map(line)];
  if (rows.some(r => r.newPlayerReturn !== null && !r.newPlayerReturnComplete)) {
    lines.push('', '* 7-day window still open: the share can still rise.');
  }
  return lines.join('\n');
}

if (typeof db === 'undefined') {
  module.exports = { seoulWeek, isGamePlayed, engagementByWeek, formatTable };
} else {
  const scores = db
    .getCollection('scores')
    .find({}, { player: 1, score: 1, hits: 1, created: 1, started: 1, pageLoadId: 1 })
    .toArray();
  print(formatTable(engagementByWeek(scores)));
}
