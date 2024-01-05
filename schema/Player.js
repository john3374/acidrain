const { randomBytes } = require('crypto');
const { Schema } = require('mongoose');

const playerSchema = new Schema(
  {
    email: { type: String, unique: true, required: true },
    nickname: { type: String, unique: true, default: `사용자_${randomBytes(4).toString('base64url')}` },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    optimisticConcurrency: true,
  }
);
module.exports = playerSchema;
