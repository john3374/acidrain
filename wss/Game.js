import crypto from 'crypto';
import mongoose from 'mongoose';
import { Game as GameDB, Score, Word } from '../schema/index.js';

const { ObjectId } = mongoose.Types;

// Seeded PRNG using Mulberry32 algorithm for better randomness
class SeededRandom {
  constructor(seed) {
    this.seed = seed || this.#generateSeed();
    this.state = this.seed;
  }

  #generateSeed() {
    // Use crypto for cryptographically secure random seed
    return crypto.randomInt(0, 0xffffffff);
  }

  // Generate random float between 0 and 1
  float() {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), this.state | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Get current seed value
  getSeed() {
    return this.seed;
  }
}

class Game {
  #client;
  #position;
  #loopId;
  #dropOffset;
  #nextQueue;
  #dropSpeed;
  #random;

  constructor(client, level = 1) {
    this.#client = client;
    this.level = level;
    this.#populateWords();
    this.ready = false;
    this.#position = [];
    this.#dropOffset = 1;
    this.life = 18;
    this.correct = 0;
    this.incorrect = 0;
    this.score = 10;
    this.width = 0;
    this.charWidth = 0;
    this.row = [];
    this.#nextQueue = [];
    this.#dropSpeed = 0;
    this.#random = new SeededRandom();
    GameDB.updateOne(
      { gameId: client.gameId },
      { $set: { correct: this.correct, incorrect: this.incorrect, life: this.life, seed: this.#random.getSeed(), score: this.score } },
      { upsert: true }
    ).catch(err => {
      console.log('failed to upsert game');
      console.log(err);
    });
    client.on('game', word => {
      // console.log(client.gameId, word);
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
      this.score = Math.max(0, this.score - 1);
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
      return;
    } else if (this.row.length === 1) {
      if (this.row[0][1] < begin) {
        this.row.push([begin, end]);
        this.#pushWord(word, begin / this.width);
        return;
      } else if (this.row[0][0] > end) {
        this.row.splice(0, 0, [begin, end]);
        this.#pushWord(word, begin / this.width);
        return;
      }
      // else overlap with existing word
    } else {
      // [word, ...]
      if (this.row[0][0] > end) {
        this.row.splice(0, 0, [begin, end]);
        this.#pushWord(word, begin / this.width);
        return;
      }
      // [..., word, ...]
      for (let i = 1, il = this.row.length; i < il; i++) {
        if (this.row[i - 1][1] < begin && this.row[i][0] > end) {
          this.row.splice(i, 0, [begin, end]);
          this.#pushWord(word, begin / this.width);
          return;
        }
      }
      // [..., word]
      if (this.row[this.row.length - 1][1] < begin) {
        this.row.push([begin, end]);
        this.#pushWord(word, begin / this.width);
        return;
      }
    }
    this.#nextQueue.push(word);
    this.#dropOffset = 1;
  }
  #pushWord(word, x) {
    this.#position.push({ x: x, y: 0, word });
    this.#client.emit('game', this.getState());
    this.#dropOffset = 0.2;
  }
  #gameUpdate() {
    this.#loopId = setTimeout(() => {
      if (this.words.length > 0) {
        if (this.#random.float() < this.#dropOffset) {
          const word = this.#nextQueue.length > 0 ? this.#nextQueue.shift() : this.words.shift();
          const pos = this.#random.float();
          const isOverflow = pos * this.width + word.length * this.charWidth > this.width;
          this.#checkOverlap(
            word,
            isOverflow ? this.width - word.length * this.charWidth : pos * this.width,
            isOverflow ? this.width : pos * this.width + word.length * this.charWidth
          );
        }
        this.#dropOffset += Math.sqrt(this.level) / Math.min(this.level * 10, 90);
      } else if (this.#position.length === 0) {
        this.level++;
        this.#client.emit('game', this.getState());
        this.stop();
        return;
      }
      for (let i = 0; i < this.#position.length; i++) {
        if (++this.#position[i].y >= 26) {
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
      this.#client.emit('game', this.getState());
      this.#gameUpdate();
    }, this.#dropSpeed);
  }

  getState() {
    return { level: this.level, life: this.life, position: this.#position, correct: this.correct, incorrect: this.incorrect, score: this.score };
  }

  start() {
    this.width = this.#client.width;
    this.charWidth = this.#client.charWidth;
    this.#dropSpeed = Math.max(184, 2200 - this.level * 200);
    console.log('start', this.#client.gameId, 'speed:', this.#dropSpeed);
    this.#gameUpdate();
  }

  stop() {
    clearTimeout(this.#loopId);
    this.#position = [];
    this.ready = false;
    this.#populateWords();
  }

  recordScore() {
    GameDB.updateOne(
      { gameId: this.#client.gameId },
      { $set: { correct: this.correct, incorrect: this.incorrect, life: this.life, score: this.score } },
      { upsert: true }
    ).catch(err => console.log('failed to update game', err));
    const score = new Score({ score: this.score });
    if (this.#client.playerId) score.player = new ObjectId(String(this.#client.playerId));
    score.save().catch(err => console.log(err));
  }

  resetGame() {
    this.score = 10;
    this.correct = 0;
    this.incorrect = 0;
    this.life = 18;
    this.level = 1;
    this.#dropOffset = 1;
  }

  status() {
    return this.#loopId;
  }
}

export default Game;
