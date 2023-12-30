const { model, models } = require('mongoose');

const gameSchema = require('./Game');
const playerSchema = require('./Player');
const scoreSchema = require('./Score');
const wordSchema = require('./Word');

const Game = models.Game || model('Game', gameSchema);
const Player = models.Player || model('Player', playerSchema);
const Score = models.Score || model('Score', scoreSchema);
const Word = models.Word || model('Word', wordSchema);

module.exports = { Game, Player, Score, Word };
