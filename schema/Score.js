import mongoose from 'mongoose';
const { Schema } = mongoose;

const scoreSchema = new Schema(
  {
    player: { type: Schema.Types.ObjectId, ref: 'Player' },
    score: { type: Number },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    optimisticConcurrency: true,
  }
);
export default scoreSchema;
