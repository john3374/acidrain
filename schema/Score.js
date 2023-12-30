const { Schema } = require('mongoose');

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
module.exports = scoreSchema;
