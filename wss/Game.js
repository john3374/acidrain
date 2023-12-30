const ObjectId = require('mongodb').ObjectId;
const { Game: GameDB, Word, Score } = require('../schema');
const { simpleFaker } = require('@faker-js/faker');

class Game {
  #client;
  #position;
  #loopId;
  #lastTime;
  #dropOffset;

  constructor(client, level = 1) {
    this.#client = client;
    this.level = level;
    this.#populateWords();
    this.ready = false;
    this.#position = [];
    this.#dropOffset = 0;
    this.life = 18;
    this.correct = 0;
    this.incorrect = 0;
    this.score = 10;
    simpleFaker.seed(Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER));
    GameDB.updateOne(
      { gameId: client.gameId },
      { $set: { correct: this.correct, incorrect: this.incorrect, life: this.life, seed: simpleFaker.seed(), score: this.score } },
      { upsert: true }
    ).catch(err => {
      console.log('failed to upsert game');
      console.log(err);
    });
  }

  #populateWords() {
    Word.aggregate([{ $unwind: '$word' }, { $sample: { size: 20 } }, { $project: { _id: 0 } }]).then(words => {
      this.words = words.map(w => w.word);
      this.ready = true;
      this.life = 18;
      this.correct = 0;
      this.incorrect = 0;
      this.level = 1;
      this.#client.emit('state', 'sReady');
    });
  }
  #gameUpdate() {
    this.#loopId = setTimeout(() => {
      const now = Date.now();

      if (this.words.length > 0) {
        if (simpleFaker.number.float() < 0.01 + this.#dropOffset) {
          this.#position.push({ x: simpleFaker.number.float(), y: 0, word: this.words.shift() });
          this.#client.emit('game', this.getState());
          this.#dropOffset = 0;
        }
      } else if (this.#position.length === 0) {
        this.level++;
        this.ready = false;
        this.#client.emit('game', this.getState());
        this.stop();
        return;
      } else this.#dropOffset += 0.01;
      if (now - this.#lastTime > (2.5 - Math.log(this.level)) * 1000) {
        if (this.#position.length === 0) this.#dropOffset *= 2;
        else
          for (let i = 0; i < this.#position.length; i++) {
            if (++this.#position[i].y >= 25) {
              this.#position.splice(i--, 1);
              if (--this.life < 0) {
                this.#client.emit('state', 'gameover');
                this.stop();
                this.recordScore();
                this.resetGame();
                return;
              }
            }
          }
        this.#lastTime = now;
        this.#client.emit('game', this.getState());
      }
      this.#gameUpdate();
    }, 30);
  }

  getState() {
    return { level: this.level, life: this.life, position: this.#position, correct: this.correct, incorrect: this.incorrect, score: this.score };
  }

  start() {
    console.log('start');
    this.#lastTime = Date.now();
    this.#client.on('game', word => {
      for (let i = 0; i < this.#position.length; i++) {
        if (this.#position[i].word === word) {
          this.#position.splice(i--, 1);
          this.correct++;
          this.score += word.length * 10 + 20;
          this.#client.emit('game', this.getState());
          return;
        }
      }
      this.incorrect++;
      this.score--;
      this.#client.emit('game', this.getState());
    });
    this.#gameUpdate();
  }

  stop() {
    clearTimeout(this.#loopId);
    this.#position = [];
    this.#populateWords();
  }

  recordScore() {
    if (this.#client.playerId) {
      const score = new Score({ score: this.score, player: new ObjectId(this.#client.playerId) });
      score.save().catch(err => console.log(err));
    } else console.log("player doesn't exist");
  }

  resetGame() {
    this.score = 10;
    this.correct = 0;
    this.incorrect = 0;
    this.life = 18;
  }
}

module.exports = Game;
