import mongoose from 'mongoose';
const { model, models } = mongoose;

import gameSchema from './Game.js';
import playerSchema from './Player.js';
import scoreSchema from './Score.js';
import wordSchema from './Word.js';

const Game = models.Game || model('Game', gameSchema);
const Player = models.Player || model('Player', playerSchema);
const Score = models.Score || model('Score', scoreSchema);
const Word = models.Word || model('Word', wordSchema);

export { Game, Player, Score, Word };
