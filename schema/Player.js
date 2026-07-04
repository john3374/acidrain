import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
const { Schema } = mongoose;

const playerSchema = new Schema(
  {
    email: { type: String, unique: true, required: true, trim: true, lowercase: true },
    nickname: {
      type: String,
      unique: true,
      trim: true,
      minlength: 1,
      maxlength: 7,
      match: /^[\p{L}\p{N}_-]+$/u,
      default: () => `사용자_${randomBytes(2).toString('base64url')}`,
    },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    optimisticConcurrency: true,
  }
);

export default playerSchema;
