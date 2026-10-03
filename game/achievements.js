// The eight Achievements (업적) and the rules that award them. Decided in john3374/acidrain#26.
// Pure: no socket, timer or database. The game-over screen and the profile popup share this list.

export const GAMES_PLAYED_THRESHOLDS = [10, 50, 100];

export const ACHIEVEMENTS = [
  { id: 'first-clear', name: '첫 걸음', condition: '아무 마당이나 처음으로 깨기' },
  { id: 'level-5', name: '5마당 돌파', condition: '5마당 깨기' },
  { id: 'level-10', name: '10마당 돌파', condition: '10마당 깨기' },
  { id: 'full-run', name: '완주', condition: '1마당에서 시작해 10마당까지 한 놀이에서 모두 깨기' },
  { id: 'flawless', name: '무결점', condition: '5마당 이상을 오타 없이, 단어를 하나도 떨어뜨리지 않고 깨기' },
  ...GAMES_PLAYED_THRESHOLDS.map(threshold => ({
    id: `games-${threshold}`,
    name: `${threshold}판 달성`,
    condition: `${threshold}판 놀기`,
    gamesPlayed: threshold,
  })),
];

export const achievementById = id => ACHIEVEMENTS.find(achievement => achievement.id === id);

const LEVEL_BONUS_STEP = 850; // The Level bonus per Level above 1, as in wss/wss.js.
const NO_HIT_MAX = 10;

// The Game played rule: a finished Game with at least one Hit. Scores saved before Hits were recorded fall back
// to their points: a Game with no Hits scores 0–10 plus the Level bonus, and a Hit is worth at least 30.
export const isGamePlayed = ({ hits, score }) => (typeof hits === 'number' ? hits > 0 : score % LEVEL_BONUS_STEP > NO_HIT_MAX);

// A Level counts as cleared when the Game went past it. Clears run from the starting Level to levelReached − 1.
const clearedLevel = ({ startingLevel, levelReached }, level) => startingLevel <= level && level < levelReached;

/**
 * The in-Game Achievements a finished Game's numbers meet, in display order.
 * `flawlessClear` is whether the Game cleared a Level of 5 or higher with no Typo and no word landing.
 */
export const inGameAchievements = game => {
  const earned = [];
  if (game.levelReached > game.startingLevel) earned.push('first-clear');
  if (clearedLevel(game, 5)) earned.push('level-5');
  if (clearedLevel(game, 10)) earned.push('level-10');
  if (game.startingLevel === 1 && clearedLevel(game, 10)) earned.push('full-run');
  if (game.flawlessClear) earned.push('flawless');
  return earned;
};

// Every step of the Games-played ladder that `gamesPlayed` reaches. Steps a Player already holds are filtered out by the caller.
export const gamesPlayedAchievements = gamesPlayed =>
  GAMES_PLAYED_THRESHOLDS.filter(threshold => gamesPlayed >= threshold).map(threshold => `games-${threshold}`);

// The next ladder step to show progress toward, or null once the ladder is complete.
export const nextGamesPlayedThreshold = gamesPlayed => GAMES_PLAYED_THRESHOLDS.find(threshold => gamesPlayed < threshold) ?? null;
