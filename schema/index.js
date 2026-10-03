import mongoose from 'mongoose';
const { model, models } = mongoose;

import achievementSchema from './Achievement.js';
import gameSchema from './Game.js';
import playerSchema from './Player.js';
import scoreSchema from './Score.js';
import wordSchema from './Word.js';

const Achievement = models.Achievement || model('Achievement', achievementSchema);
const Game = models.Game || model('Game', gameSchema);
const Player = models.Player || model('Player', playerSchema);
const Score = models.Score || model('Score', scoreSchema);
const Word = models.Word || model('Word', wordSchema);

export { Achievement, Game, Player, Score, Word };
