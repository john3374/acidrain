import mongoose from 'mongoose';
const { Schema } = mongoose;

const gameSchema = new Schema(
  {
    gameId: { type: String, unique: true, required: true },
    player: { type: Schema.Types.ObjectId, ref: 'Player', index: true },
    correct: { type: Number, min: 0, default: 0 },
    incorrect: { type: Number, min: 0, default: 0 },
    level: { type: Number, min: 1, max: 10, default: 1 },
    seed: { type: Number, min: 0 },
    life: { type: Number, min: 0, max: 18, default: 18 },
    score: { type: Number, min: 0, max: 10000000, default: 10 },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    optimisticConcurrency: true,
  }
);

export default gameSchema;
