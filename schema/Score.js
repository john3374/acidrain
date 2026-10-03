import mongoose from 'mongoose';
const { Schema } = mongoose;

const scoreSchema = new Schema(
  {
    player: { type: Schema.Types.ObjectId, ref: 'Player', index: true },
    score: { type: Number, required: true, min: 0, max: 10000000 },
    // When the Game's first Level started. Missing on Scores saved before it was recorded.
    started: { type: Date },
    // Guest Scores only: the socket's per-page-load clientId, so Replays can be counted without a stored identifier.
    pageLoadId: { type: String },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    optimisticConcurrency: true,
  }
);

scoreSchema.index({ score: -1, created: -1 });
scoreSchema.index({ created: -1, score: -1 });

export default scoreSchema;
