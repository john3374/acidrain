import mongoose from 'mongoose';
const { Schema } = mongoose;

// One record per Player per Achievement (업적). Only Players keep Achievements; a Guest's are never saved.
const achievementSchema = new Schema(
  {
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    achievement: { type: String, required: true },
    // The Score of the Game that earned it, and when that Game finished.
    score: { type: Schema.Types.ObjectId, ref: 'Score' },
    earned: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
  }
);

achievementSchema.index({ player: 1, achievement: 1 }, { unique: true });

export default achievementSchema;
