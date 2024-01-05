const ObjectId = require('mongodb').ObjectId;
const { Game: GameDB, Word, Score } = require('../schema');
const { simpleFaker } = require('@faker-js/faker');

class Game {
  #client;
  #position;
  #loopId;
  #lastTime;
  #dropOffset;
  #nextQueue;
  #dropSpeed;

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
    this.width = 0;
    this.charWidth = 0;
    this.row = [];
    this.#nextQueue = [];
    this.#dropSpeed = 0;
    simpleFaker.seed(Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER));
    GameDB.updateOne(
      { gameId: client.gameId },
      { $set: { correct: this.correct, incorrect: this.incorrect, life: this.life, seed: simpleFaker.seed(), score: this.score } },
      { upsert: true }
    ).catch(err => {
      console.log('failed to upsert game');
      console.log(err);
    });
    client.on('game', word => {
      console.log(client.gameId, word);
      for (let i = 0; i < this.#position.length; i++) {
        if (this.#position[i].word === word) {
          this.#position.splice(i--, 1);
          this.correct++;
          this.score += word.length * 10 + 20;
          client.emit('game', this.getState());
          return;
        }
      }
      this.incorrect++;
      this.score--;
      client.emit('game', this.getState());
    });
  }

  #populateWords() {
    if (!this.ready)
      Word.aggregate([{ $unwind: '$word' }, { $sample: { size: 20 } }, { $project: { _id: 0 } }]).then(words => {
        this.words = words.map(w => w.word);
        this.ready = true;
        this.#client.emit('state', 'sReady');
      });
  }
  #checkOverlap(word, begin, end) {
    if (this.row.length === 0) {
      this.row.push([begin, end]);
      this.#pushWord(word, begin / this.width);
    } else if (this.row.length === 1) {
      if (this.row[0][1] < begin) {
        this.row.push([begin, end]);
        this.#pushWord(word, begin / this.width);
      } else {
        this.row.splice(0, 0, [begin, end]);
        this.#pushWord(word, begin / this.width);
      }
    } else {
      for (let i = 1, il = this.row.length; i < il; i++) {
        if (this.row[i - 1][1] < begin && this.row[i][0] > end) {
          this.row.splice(i, 0, [begin, end]);
          this.#pushWord(word, begin / this.width);
          return;
        }
      }
      if (this.row[this.row.length - 1][1] < begin) {
        this.row.push([begin, end]);
        this.#pushWord(word, begin / this.width);
        return;
      }
      this.#nextQueue.push(word);
      this.#lastTime = 0;
    }
  }
  #pushWord(word, x) {
    this.#position.push({ x, y: 0, word });
    this.#client.emit('game', this.getState());
    this.#dropOffset = 0;
  }
  #gameUpdate() {
    this.#loopId = setTimeout(() => {
      const now = Date.now();
      if (this.#nextQueue.length > 0) console.log(this.#nextQueue);
      if (this.words.length > 0) {
        if (this.#nextQueue.length > 0 || simpleFaker.number.float() < 0.01 + this.#dropOffset) {
          const word = this.#nextQueue.length > 0 ? this.#nextQueue.shift() : this.words.shift();
          const pos = simpleFaker.number.float();
          const isOverflow = pos * this.width + word.length * this.charWidth > this.width;
          this.#checkOverlap(
            word,
            isOverflow ? this.width - word.length * this.charWidth : pos * this.width,
            isOverflow ? this.width : pos * this.width + word.length * this.charWidth
          );
        }
      } else if (this.#position.length === 0) {
        this.level++;
        this.#client.emit('game', this.getState());
        this.stop();
        return;
      } else this.#dropOffset += 0.01 * this.level;
      if (now - this.#lastTime > this.#dropSpeed) {
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
        this.row = [];
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
    console.log(this.#client.gameId, 'start');
    this.#lastTime = Date.now();
    this.width = this.#client.width;
    this.#dropSpeed = 3000 - this.level * 200;
    this.#gameUpdate();
  }

  stop() {
    clearTimeout(this.#loopId);
    this.#position = [];
    this.ready = false;
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
    this.level = 1;
  }

  status() {
    return this.#loopId;
  }
}

module.exports = Game;
