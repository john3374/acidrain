import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
const { Schema } = mongoose;

const playerSchema = new Schema(
  {
    email: { type: String, unique: true, required: true },
    nickname: { type: String, unique: true, default: () => `사용자_${randomBytes(4).toString('base64url')}` },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    optimisticConcurrency: true,
  }
);
export default playerSchema;
