import mongoose from 'mongoose';
const { Schema } = mongoose;

const gameSchema = new Schema(
  {
    gameId: { type: String, unique: true },
    player: { type: Schema.Types.ObjectId, ref: 'Player' },
    correct: { type: Number },
    incorrect: { type: Number },
    level: { type: Number },
    seed: { type: Number },
    life: { type: Number },
    score: { type: Number },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    optimisticConcurrency: true,
  }
);
export default gameSchema;
