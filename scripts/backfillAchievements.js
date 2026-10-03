// One-time backfill of the Games-played ladder (10판 / 50판 / 100판 달성) from existing Player Scores, as decided in #26.
// In-Game Achievements aren't backfilled: old Scores have no Hits or Level reached.
//
// Usage: node scripts/backfillAchievements.js [--dry-run]
//
// Reads MongoDB settings from .env like `pnpm wss`. Safe to run again: steps a Player already holds are skipped.
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../db.js';
import { backfillGamesPlayed } from '../lib/achievements.js';
import { Player } from '../schema/index.js';

const dryRun = process.argv.includes('--dry-run');

const main = async () => {
  await connectDB();
  const players = await Player.find({}, { nickname: 1 }).lean();
  let awarded = 0;
  for (const player of players) {
    const { gamesPlayed, records } = await backfillGamesPlayed(player._id, { dryRun });
    if (records.length === 0) continue;
    awarded += records.length;
    const steps = records.map(r => `${r.achievement} (${r.earned.toISOString().slice(0, 10)})`).join(', ');
    console.log(`${player.nickname}: ${gamesPlayed} Games played → ${steps}`);
  }
  console.log(`${dryRun ? 'Would award' : 'Awarded'} ${awarded} Achievement(s) across ${players.length} Player(s).`);
};

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
