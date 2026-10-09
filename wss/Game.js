import crypto from 'crypto';
import mongoose from 'mongoose';
import { inGameAchievements } from '../game/achievements.js';
import { awardAchievements } from '../lib/achievements.js';
import { Game as GameDB, Player, Score, Word } from '../schema/index.js';

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

// Enough for a player who turns their phone by accident; too few to turn the Pause into free thinking time.
const PAUSES_PER_LEVEL = 3;

class Game {
  #client;
  #position;
  #loopId;
  #dropOffset;
  #nextQueue;
  #dropSpeed;
  #random;
  #scoreRecorded;
  // How many Games this connection has finished; `result` carries it so the browser can match it to the right Game over.
  #finished = 0;
  #started;
  #startingLevel;
  #flawlessClear;
  #levelTypos;
  #levelLife;
  // The drop timer is stopped mid-Level while the player can't see the game (a phone turned sideways).
  #paused = false;
  // When the next drop is due, and how much of its wait was left at the Pause: resuming waits only that long,
  // so pausing and resuming over and over can't hold the words up.
  #dropDue;
  #dropLeft;
  #pausesLeft;

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
    this.#scoreRecorded = false;
    this.#flawlessClear = false;
    this.bonus = 0;
    GameDB.updateOne(
      { gameId: client.gameId },
      { $set: { correct: this.correct, incorrect: this.incorrect, life: this.life, seed: this.#random.getSeed(), score: this.score } },
      { upsert: true },
    ).catch(err => {
      console.log('failed to upsert game');
      console.log(err);
    });
    client.on('game', word => {
      const submitted = typeof word === 'string' ? word.trim() : '';
      if (!submitted || submitted.length > 100) return;
      // The words are hidden while paused; typing them then would be free Hits.
      if (this.#paused) return;

      for (let i = 0; i < this.#position.length; i++) {
        if (this.#position[i].word === submitted) {
          this.#position.splice(i--, 1);
          this.correct++;
          this.score += submitted.length * 10 + 20;
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
  #gameUpdate(delay = this.#dropSpeed) {
    this.#dropDue = Date.now() + delay;
    this.#loopId = setTimeout(() => {
      if (this.words.length > 0) {
        if (this.#random.float() < this.#dropOffset) {
          const word = this.#nextQueue.length > 0 ? this.#nextQueue.shift() : this.words.shift();
          const pos = this.#random.float();
          const isOverflow = pos * this.width + word.length * this.charWidth > this.width;
          this.#checkOverlap(
            word,
            isOverflow ? this.width - word.length * this.charWidth : pos * this.width,
            isOverflow ? this.width : pos * this.width + word.length * this.charWidth,
          );
        }
        this.#dropOffset += Math.sqrt(this.level) / Math.min(this.level * 10, 90);
      } else if (this.#position.length === 0) {
        this.levelClear();
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
    }, delay);
  }

  // Every word of the Level has been typed or has landed while pH remains: the next Level follows.
  levelClear() {
    // 무결점: a Level of 5 or higher cleared with no Typo and no word landing (a landing costs pH).
    if (this.level >= 5 && this.incorrect === this.#levelTypos && this.life === this.#levelLife) this.#flawlessClear = true;
    this.level++;
    this.#client.emit('game', this.getState());
    this.stop();
  }

  getState() {
    return { level: this.level, life: this.life, position: this.#position, correct: this.correct, incorrect: this.incorrect, score: this.score };
  }

  start() {
    if (this.#loopId || this.#paused) return;

    this.width = this.#client.width;
    this.charWidth = this.#client.charWidth;
    this.#dropSpeed = Math.max(184, 2200 - this.level * 200);
    // The Game starts with its first Level; later Levels keep this time and the starting Level.
    this.#started ??= new Date();
    this.#startingLevel ??= this.level;
    this.#levelTypos = this.incorrect;
    this.#levelLife = this.life;
    this.#pausesLeft = PAUSES_PER_LEVEL;
    console.log('start', this.#client.gameId, 'speed:', this.#dropSpeed);
    this.#gameUpdate();
  }

  // Holds the falling words, pH and Score where they are. Only a Level in progress can pause,
  // and only PAUSES_PER_LEVEL times; after that the Game keeps running.
  pause() {
    if (!this.#loopId || this.#pausesLeft <= 0) return false;
    this.#pausesLeft--;
    clearTimeout(this.#loopId);
    this.#loopId = null;
    this.#dropLeft = Math.max(0, this.#dropDue - Date.now());
    this.#paused = true;
    return true;
  }

  resume() {
    if (!this.#paused) return false;
    this.#paused = false;
    this.#gameUpdate(this.#dropLeft);
    return true;
  }

  stop() {
    clearTimeout(this.#loopId);
    this.#loopId = null;
    this.#paused = false;
    this.#position = [];
    this.ready = false;
    if (this.bonus > 0) {
      this.score += this.bonus;
      this.bonus = 0;
    }
    this.#populateWords();
  }

  recordScore() {
    if (this.#scoreRecorded) return;
    this.#scoreRecorded = true;
    const sequence = ++this.#finished;

    GameDB.updateOne(
      { gameId: this.#client.gameId },
      { $set: { correct: this.correct, incorrect: this.incorrect, life: this.life, score: this.score } },
      { upsert: true },
    ).catch(err => console.log('failed to update game', err));

    // Capture the Game's numbers now: the caller resets the Game right after this returns.
    const game = {
      startingLevel: this.#startingLevel ?? this.level,
      levelReached: this.level,
      flawlessClear: this.#flawlessClear,
      hits: this.correct,
      typos: this.incorrect,
    };
    const score = new Score({
      score: this.score,
      started: this.#started,
      startingLevel: game.startingLevel,
      levelReached: game.levelReached,
      hits: game.hits,
      typos: game.typos,
    });
    const client = this.#client;
    const playerId = client.playerId;
    const pageLoadId = client.gameId;
    this.#savePlayerScore(score, playerId, pageLoadId)
      .then(() => this.#sendResult(client, score, game, sequence))
      .catch(err => console.log('failed to save score', err));
  }

  // The additive `result` event: the Achievements this Game earned. A Guest only sees what a Player would have kept.
  async #sendResult(client, score, game, sequence) {
    let achievements;
    let guest = true;
    if (score.player) {
      guest = false;
      try {
        achievements = await awardAchievements({ playerId: score.player, score, game });
      } catch (err) {
        console.log('failed to award achievements', err);
        return;
      }
    } else {
      achievements = inGameAchievements(game);
    }
    client.emit('result', { sequence, achievements, guest });
  }

  // Attach the Player only if they still exist; otherwise the Score is saved as a Guest Score with the page-load ID.
  async #savePlayerScore(score, playerId, pageLoadId) {
    if (playerId && ObjectId.isValid(String(playerId))) {
      const _id = new ObjectId(String(playerId));
      let exists = false;
      try {
        exists = Boolean(await Player.exists({ _id }));
      } catch (err) {
        console.log('failed to check player; saving score as guest', err);
      }
      if (exists) score.player = _id;
    }
    if (!score.player) score.pageLoadId = pageLoadId;
    await score.save();
  }

  // The page closed or the connection dropped mid-Game: the Game is abandoned, not finished.
  // Stop the timer so pH can't run out later, and make sure nothing is saved or awarded.
  abandon() {
    clearTimeout(this.#loopId);
    this.#loopId = null;
    this.#paused = false;
    this.#position = [];
    this.#scoreRecorded = true;
  }

  resetGame() {
    this.score = 10;
    this.correct = 0;
    this.incorrect = 0;
    this.life = 18;
    this.level = 1;
    this.#dropOffset = 1;
    this.#scoreRecorded = false;
    this.#started = undefined;
    this.#startingLevel = undefined;
    this.#flawlessClear = false;
  }

  status() {
    return this.#loopId;
  }
}

export default Game;
